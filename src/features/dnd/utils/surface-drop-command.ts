import { rejectionReasonMessage } from './drop-rejections'
import type { SurfaceBatchDropCommand, SurfaceDropCommand } from './surface-drop-planner'
import { getDropTargetKey } from './drop-target-data'
import type { DndBatchDecision } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { getSurfaceDropContribution } from './surface-drop-vocabulary'
import type { SurfaceDropAction } from './surface-drop-vocabulary'

type SurfaceAction = SurfaceBatchDropCommand['action']
type SurfaceBatchDropCommandByAction<TAction extends SurfaceDropAction> = Extract<
  SurfaceBatchDropCommand,
  { action: TAction }
>
type SurfaceDropExecutor<TAction extends SurfaceDropAction> = (
  command: SurfaceBatchDropCommandByAction<TAction>,
  input: SurfaceDropExecutionInput,
) => Promise<void>
type RegisteredSurfaceDropExecutor = (
  command: SurfaceBatchDropCommand,
  input: SurfaceDropExecutionInput,
) => Promise<void>

type SurfaceDropExecutionInput = {
  clientX: number
  clientY: number
}

const surfaceDropExecutors = new Map<string, RegisteredSurfaceDropExecutor>()

function surfaceDropExecutorKey(commandId: string, target: Record<string, unknown>) {
  const targetKey = getDropTargetKey(target)
  return targetKey ? `${commandId}:${targetKey}` : null
}

function isBatchDropCommand(command: SurfaceDropCommand): command is SurfaceBatchDropCommand {
  return command.status === 'ready' || command.status === 'partial' || command.status === 'failed'
}

function commandMatchesAction<TAction extends SurfaceAction>(
  command: SurfaceBatchDropCommand,
  action: TAction,
): command is SurfaceBatchDropCommand & { action: TAction } {
  return command.action === action
}

export function registerSurfaceDropExecutor<TAction extends SurfaceDropAction>({
  action,
  target,
  execute,
}: {
  action: TAction
  target: SurfaceBatchDropCommandByAction<TAction>['target']
  execute: SurfaceDropExecutor<TAction>
}): () => void {
  const contribution = getSurfaceDropContribution(action)
  const key = surfaceDropExecutorKey(contribution.commandId, target)
  if (!key) return () => undefined

  const registered: RegisteredSurfaceDropExecutor = (command, input) =>
    execute(command as SurfaceBatchDropCommandByAction<TAction>, input)
  surfaceDropExecutors.set(key, registered)

  return () => {
    if (surfaceDropExecutors.get(key) === registered) {
      surfaceDropExecutors.delete(key)
    }
  }
}

export async function executeRegisteredSurfaceDropCommand({
  command,
  input,
  setBatchDecision,
}: {
  command: SurfaceDropCommand
  input: SurfaceDropExecutionInput
  setBatchDecision: (decision: DndBatchDecision | null) => void
}): Promise<boolean> {
  if (!isBatchDropCommand(command)) return false

  const key = surfaceDropExecutorKey(command.commandId, command.target)
  const executor = key ? surfaceDropExecutors.get(key) : null
  if (!executor) return false

  await executeSurfaceDropCommand({
    command,
    action: command.action,
    setBatchDecision,
    failureMessage: getSurfaceDropContribution(command.action).failureMessage,
    execute: async (batchCommand) => executor(batchCommand, input),
  })
  return true
}

async function executeSurfaceDropCommand<TAction extends SurfaceAction>({
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
