import { rejectionReasonMessage } from './drop-rejections'
import { resolveSurfaceDropCommand } from './surface-drop-planner'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import type { SurfaceDropPlanningContext } from './drop-planning-context'
import type { SurfaceBatchDropCommand, SurfaceDropCommand } from './surface-drop-planner'
import type { SidebarDropData } from './drop-target-data'
import type { DndBatchDecision } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { getDragItemIds } from './drag-source-data'
import { resolveSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'

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
  const sidebarItems = resolveSidebarOperationItems({
    itemIds: getDragItemIds(sourceData),
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

  const run = () => execute(command)

  if (command.status === 'failed') {
    handleError(
      new Error(rejectionReasonMessage(command.rejectedItems[0]?.reason ?? 'unexpected_action')),
      'Cannot drop items here',
    )
    return
  }

  if (command.status === 'partial') {
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
