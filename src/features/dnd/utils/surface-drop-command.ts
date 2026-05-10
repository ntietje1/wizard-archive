import { rejectionReasonMessage } from './drop-rejections'
import { resolveSurfaceDropCommand } from './surface-drop-planner'
import { resolveNormalizedDraggedSidebarItems } from './sidebar-drag-items'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SurfaceDropPlanningContext } from './drop-planning-context'
import type { SurfaceBatchDropCommand, SurfaceDropCommand } from './surface-drop-planner'
import type { SidebarDropData } from './drop-target-data'
import type { DndBatchDecision } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'

type SurfaceAction = SurfaceBatchDropCommand['action']

function isBatchDropCommand(command: SurfaceDropCommand): command is SurfaceBatchDropCommand {
  return command.status === 'ready' || command.status === 'partial' || command.status === 'failed'
}

function commandMatchesAction<TAction extends SurfaceAction>(
  command: SurfaceBatchDropCommand,
  action: TAction,
): command is SurfaceBatchDropCommand & { action: TAction } {
  return command.action === action
}

export function resolveSidebarSurfaceDropCommand({
  sourceData,
  activeItemsMap,
  trashedItemsMap,
  target,
  planningContext,
}: {
  sourceData: Record<string, unknown>
  activeItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashedItemsMap?: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  target: SidebarDropData
  planningContext: SurfaceDropPlanningContext
}): SurfaceDropCommand {
  const sidebarItems = resolveNormalizedDraggedSidebarItems({
    sourceData,
    activeItemsMap,
    trashedItemsMap,
    includeTrashed: true,
  })
  return resolveSurfaceDropCommand(sidebarItems, target, planningContext)
}

export async function executeSurfaceDropCommand<TAction extends SurfaceAction>({
  command,
  action,
  setBatchDecision,
  execute,
  failureMessage,
}: {
  command: SurfaceDropCommand
  action: TAction
  setBatchDecision: (decision: DndBatchDecision | null) => void
  execute: (command: SurfaceBatchDropCommand & { action: TAction }) => Promise<void>
  failureMessage: string
}): Promise<void> {
  if (command.status === 'blocked') {
    handleError(new Error(rejectionReasonMessage(command.reason)), 'Cannot drop items here')
    return
  }
  if (!isBatchDropCommand(command) || !commandMatchesAction(command, action)) return

  const run = async () => {
    await execute(command)
  }

  if (command.status === 'partial' || command.status === 'failed') {
    setBatchDecision({
      command,
      onConfirm: async () => {
        try {
          await run()
        } catch (error) {
          handleError(error, failureMessage)
        }
      },
    })
    return
  }

  await run().catch((error) => handleError(error, failureMessage))
}
