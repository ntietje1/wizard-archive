import type { DndBatchDecision } from './batch-decision'
import { createKeyedExecutorRegistry } from './executor-registry'
import type { DndExternalFileDropContext } from './file-drop'
import type { DropInput, PlannedDropCommand, SequentialDropCommand } from './drop-command'
import type { ResourceCommandResult } from '../filesystem/transaction-contract'
import type { DndExecutionContext } from './monitor-context'
import { executeRegisteredSurfaceDropCommand } from './surface-command'
import { createSurfaceDropCommandUiEffects } from './surface-command-effects'
import type { SurfaceDropCommandEffects } from './surface-command-effects'

type SurfaceFileImportCommand = Extract<PlannedDropCommand, { kind: 'surfaceFileImport' }>
type SurfaceExternalUrlDropCommand = Extract<PlannedDropCommand, { kind: 'surfaceExternalUrl' }>
type DropInteractionCommand = Exclude<PlannedDropCommand, { kind: 'filesystem' }>
type SurfaceFileImportExecutor = (
  command: SurfaceFileImportCommand,
  input: DropInput,
) => Promise<unknown>
type SurfaceExternalUrlDropExecutor = (
  command: SurfaceExternalUrlDropCommand,
  input: DropInput,
) => Promise<unknown>

type DropCommandExecutionContext = DndExecutionContext &
  Partial<Pick<DndExternalFileDropContext, 'handleDropFiles'>> & {
    setBatchDecision: (decision: DndBatchDecision | null) => void
    surfaceEffects?: SurfaceDropCommandEffects
  }

const surfaceFileImportExecutors = createKeyedExecutorRegistry<SurfaceFileImportExecutor>()
const surfaceExternalUrlDropExecutors =
  createKeyedExecutorRegistry<SurfaceExternalUrlDropExecutor>()
const defaultSurfaceEffects = createSurfaceDropCommandUiEffects()

export function registerSurfaceFileImportExecutor({
  commandId,
  execute,
  target,
}: {
  commandId: string
  execute: SurfaceFileImportExecutor
  target: SurfaceFileImportCommand['target']
}) {
  return surfaceFileImportExecutors.register({
    prefix: commandId,
    target,
    execute,
  })
}

export function registerSurfaceExternalUrlDropExecutor({
  commandId,
  execute,
  target,
}: {
  commandId: SurfaceExternalUrlDropCommand['commandId']
  execute: SurfaceExternalUrlDropExecutor
  target: SurfaceExternalUrlDropCommand['target']
}) {
  return surfaceExternalUrlDropExecutors.register({
    prefix: commandId,
    target,
    execute,
  })
}

export async function executePlannedDropCommand(
  command: PlannedDropCommand,
  input: DropInput,
  ctx: DropCommandExecutionContext,
): Promise<ResourceCommandResult | void> {
  if (command.kind === 'filesystem') {
    return ctx.executeFileSystemCommand(command.plan.command)
  }
  await executeDropInteractionCommand(command, input, ctx)
}

async function executeDropInteractionCommand(
  command: DropInteractionCommand,
  input: DropInput,
  ctx: DropCommandExecutionContext,
): Promise<void> {
  const effects = ctx.surfaceEffects ?? defaultSurfaceEffects
  switch (command.kind) {
    case 'noop':
      return
    case 'blocked':
      effects.reportRejection(command.reason)
      return
    case 'openResource':
      await ctx.openItem(command.item)
      return
    case 'surface':
      return executeSurfaceDropCommand(command, input, ctx)
    case 'fileImport':
      return executeFileImportCommand(command, ctx)
    case 'surfaceFileImport':
      return executeSurfaceFileImportCommand(command, input, effects)
    case 'surfaceExternalUrl':
      return executeSurfaceExternalUrlDropCommand(command, input, effects)
    case 'sequence':
      return executeDropCommandSequence(command.commands, input, ctx)
  }
}

async function executeSurfaceDropCommand(
  command: Extract<PlannedDropCommand, { kind: 'surface' }>,
  input: DropInput,
  ctx: DropCommandExecutionContext,
): Promise<void> {
  return executeRegisteredSurfaceDropCommand({
    command: command.command,
    effects: ctx.surfaceEffects ?? defaultSurfaceEffects,
    input,
    setBatchDecision: ctx.setBatchDecision,
  })
}

async function executeFileImportCommand(
  command: Extract<PlannedDropCommand, { kind: 'fileImport' }>,
  ctx: DropCommandExecutionContext,
): Promise<void> {
  const effects = ctx.surfaceEffects ?? defaultSurfaceEffects
  if (!ctx.handleDropFiles) {
    effects.reportError(
      new Error('Missing external file import handler'),
      'Cannot import files here',
    )
    return
  }
  const result = await ctx.handleDropFiles(command.dropResult, { destination: command.destination })
  if (result.status === 'unsupported') {
    effects.reportError(new Error(result.reason), 'Cannot import files here')
  }
}

async function executeSurfaceFileImportCommand(
  command: SurfaceFileImportCommand,
  input: DropInput,
  effects: SurfaceDropCommandEffects,
): Promise<void> {
  const executor = surfaceFileImportExecutors.get(command.commandId, command.target)
  if (!executor) {
    effects.reportError(
      new Error(`Missing surface file import executor for ${command.commandId}`),
      'Cannot import files here',
    )
    return
  }

  await executor(command, input)
}

async function executeSurfaceExternalUrlDropCommand(
  command: SurfaceExternalUrlDropCommand,
  input: DropInput,
  effects: SurfaceDropCommandEffects,
): Promise<void> {
  const executor = surfaceExternalUrlDropExecutors.get(command.commandId, command.target)
  if (!executor) {
    effects.reportError(
      new Error(`Missing surface URL drop executor for ${command.commandId}`),
      'Cannot add this link here',
    )
    return
  }

  await executor(command, input)
}

async function executeDropCommandSequence(
  commands: Array<SequentialDropCommand>,
  input: DropInput,
  ctx: DropCommandExecutionContext,
): Promise<void> {
  for (const command of commands) {
    await executeDropInteractionCommand(command, input, ctx)
  }
}
