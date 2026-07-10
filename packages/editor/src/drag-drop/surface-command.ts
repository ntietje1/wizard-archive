import type { SurfaceBatchDropCommand, SurfaceDropCommand } from './surface-planner'
import type { DndBatchDecision } from './batch-decision'
import { getSurfaceDropContribution } from './surface-vocabulary'
import type { SurfaceDropAction } from './surface-vocabulary'
import { createKeyedExecutorRegistry } from './executor-registry'
import { createSurfaceDropCommandUiEffects } from './surface-command-effects'
import type { SurfaceDropCommandEffects } from './surface-command-effects'

type SurfaceAction = SurfaceBatchDropCommand['action']
type ExecutableSurfaceBatchDropCommand = Exclude<SurfaceBatchDropCommand, { status: 'failed' }>
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

const surfaceDropExecutors = createKeyedExecutorRegistry<RegisteredSurfaceDropExecutor>()
const defaultSurfaceDropCommandEffects = createSurfaceDropCommandUiEffects()

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
  const registered: RegisteredSurfaceDropExecutor = (command, input) =>
    execute(command as SurfaceBatchDropCommandByAction<TAction>, input)
  return surfaceDropExecutors.register({
    prefix: contribution.commandId,
    target,
    execute: registered,
  })
}

export async function executeRegisteredSurfaceDropCommand({
  command,
  input,
  setBatchDecision,
  effects = defaultSurfaceDropCommandEffects,
}: {
  command: SurfaceDropCommand
  input: SurfaceDropExecutionInput
  setBatchDecision: (decision: DndBatchDecision | null) => void
  effects?: SurfaceDropCommandEffects
}): Promise<void> {
  if (command.status === 'noop') return
  if (command.status === 'blocked') {
    effects.reportRejection(command.reason)
    return
  }
  if (command.status === 'failed') {
    effects.reportRejections(
      command.rejectedItems.length > 0
        ? command.rejectedItems.map(({ reason }) => reason)
        : ['unexpected_action'],
    )
    return
  }

  const executor = surfaceDropExecutors.get(command.commandId, command.target)
  if (!executor) {
    const error = new Error(`Missing surface drop executor for ${command.commandId}`)
    effects.reportError(error, 'Cannot drop items here')
    return
  }

  return executeSurfaceDropCommandResult({
    command,
    action: command.action,
    setBatchDecision,
    failureMessage: getSurfaceDropContribution(command.action).failureMessage,
    execute: async (batchCommand) => executor(batchCommand, input),
    effects,
  })
}

async function executeSurfaceDropCommandResult<TAction extends SurfaceAction>({
  command,
  action,
  setBatchDecision,
  execute,
  failureMessage,
  effects,
}: {
  command: ExecutableSurfaceBatchDropCommand
  action: TAction
  setBatchDecision: (decision: DndBatchDecision | null) => void
  execute: (command: SurfaceBatchDropCommand & { action: TAction }) => Promise<void>
  failureMessage: string
  effects: SurfaceDropCommandEffects
}): Promise<void> {
  if (!isBatchDropCommand(command) || !commandMatchesAction(command, action)) return

  const run = async () => {
    try {
      await execute(command)
    } catch (error) {
      effects.reportError(error, failureMessage)
    }
  }

  if (command.status === 'partial') {
    setBatchDecision({
      command,
      onConfirm: run,
    })
    return
  }

  await run()
}
