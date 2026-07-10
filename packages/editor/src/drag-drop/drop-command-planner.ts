import type { AnyItem } from '../workspace/items'
import {
  resolveFileSystemDropTarget,
  resolveGlobalFileSystemDropCommand,
} from '../filesystem/drop-planner'
import type { FileSystemDropOptions } from '../filesystem/domain/intent-planning'
import { resolveSurfaceDropCommand } from './surface-planner'
import type { SurfaceDropOptions } from './surface-planner'
import type { DropPlanningContext } from './planning-context'
import type { SidebarDropData } from './drop-target-data'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from './drop-target-data'
import type { DropResult, FileDropDestination } from './file-drop'
import type { DropOutcome } from './outcome'
import type { DropPayload, PlannedDropCommand, SequentialDropCommand } from './drop-command'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'
import type {
  ExternalFileDropRoute,
  ExternalFileDropTargetCapability,
} from './external-file-drop-target'
import { resolveExternalFileDropTarget } from './external-file-drop-target'

type DropCommandOptions = FileSystemDropOptions & SurfaceDropOptions

export function resolveDropCommand({
  payload,
  target,
  ctx,
  options = {},
}: {
  payload: DropPayload
  target: SidebarDropData | null
  ctx: DropPlanningContext
  options?: DropCommandOptions
}): PlannedDropCommand {
  switch (payload.kind) {
    case 'resources':
      return resolveResourceDropCommand(payload.items, target, ctx, options)
    case 'externalFiles':
      return resolveExternalFileDropCommand(payload.dropResult, target)
    case 'externalUrl':
      return resolveExternalUrlDropCommand(payload.target, target)
    case 'rejectedExternalUrl':
      return { kind: 'blocked', reason: payload.reason }
  }
}

export function resolveDropCommandFeedback(command: PlannedDropCommand): DropOutcome | null {
  switch (command.kind) {
    case 'noop':
      return null
    case 'blocked':
      return { type: 'rejection', reason: command.reason }
    case 'openResource':
      return { type: 'operation', action: 'open', label: command.label }
    case 'filesystem':
      return {
        type: 'operation',
        action: command.plan.command.type,
        label: command.plan.label,
      }
    case 'surface':
      return surfaceCommandFeedback(command.command)
    case 'fileImport':
    case 'surfaceFileImport':
    case 'surfaceExternalUrl':
      return { type: 'operation', action: 'copy', label: command.label }
    case 'sequence':
      return resolveDropCommandFeedback(command.commands[0] ?? { kind: 'noop' })
  }
}

function resolveResourceDropCommand(
  items: Array<AnyItem>,
  target: SidebarDropData | null,
  ctx: DropPlanningContext,
  options: DropCommandOptions,
): PlannedDropCommand {
  if (items.length === 0) return { kind: 'noop' }
  if (!target) return { kind: 'blocked', reason: 'missing_data' }
  if (target.type === 'empty-editor') {
    return {
      kind: 'openResource',
      item: items[0],
      label: 'Open item',
    }
  }

  const fileSystemTarget = resolveFileSystemDropTarget(target, ctx)
  if (fileSystemTarget) {
    const command = resolveGlobalFileSystemDropCommand(items, fileSystemTarget, ctx, options)
    if (command.status === 'noop') return { kind: 'noop' }
    if (command.status === 'blocked') return { kind: 'blocked', reason: command.reason }
    return {
      kind: 'filesystem',
      plan: command.plan,
    }
  }

  const command = resolveSurfaceDropCommand(items, target, ctx, options)
  if (command.status === 'noop') return { kind: 'noop' }
  return {
    kind: 'surface',
    command,
  }
}

function resolveExternalUrlDropCommand(
  embedTarget: EmbedTarget,
  target: SidebarDropData | null,
): PlannedDropCommand {
  if (!target) return { kind: 'blocked', reason: 'missing_data' }
  if (target.type === CANVAS_DROP_ZONE_TYPE) {
    return {
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.canvas',
      target,
      embedTarget,
      label: 'Drop URL on canvas',
    }
  }
  if (target.type === EMPTY_EMBED_DROP_TYPE) {
    return {
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.empty-embed',
      target,
      embedTarget,
      label: 'Drop URL on embed',
    }
  }
  if (target.type === NOTE_EDITOR_DROP_TYPE) {
    return {
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.note-editor',
      target,
      embedTarget,
      label: 'Drop URL in note',
    }
  }

  return { kind: 'blocked', reason: 'unsupported_target' }
}

function resolveExternalFileDropCommand(
  dropResult: DropResult,
  target: SidebarDropData | null,
): PlannedDropCommand {
  if (dropResult.files.length === 0 && dropResult.rootFolders.length === 0) return { kind: 'noop' }
  const fileTarget = resolveExternalFileDropTarget(target)
  switch (fileTarget.kind) {
    case 'blocked':
      return { kind: 'blocked', reason: fileTarget.reason }
    case 'accepted':
      return resolveExternalFileRoutes(dropResult, fileTarget, target)
  }
}

function resolveExternalFileRoutes(
  dropResult: DropResult,
  routes: Extract<ExternalFileDropTargetCapability, { kind: 'accepted' }>,
  target: SidebarDropData | null,
): PlannedDropCommand {
  const fileDropResult = { files: dropResult.files, rootFolders: [] }
  const folderDropResult = { files: [], rootFolders: dropResult.rootFolders }
  const commands: Array<SequentialDropCommand> = []

  if (fileDropResult.files.length > 0) {
    if (target?.type === EMPTY_EMBED_DROP_TYPE && fileDropResult.files.length > 1) {
      return { kind: 'blocked', reason: 'unexpected_action' }
    }
    const fileRoute = routes.files
    if (!fileRoute) return { kind: 'blocked', reason: 'unsupported_target' }
    commands.push(resolveExternalFileRoute(fileDropResult, fileRoute, target))
  }
  if (folderDropResult.rootFolders.length > 0) {
    const folderRoute = routes.browserFolders
    if (!folderRoute) return { kind: 'blocked', reason: 'unsupported_target' }
    commands.push(resolveExternalFileRoute(folderDropResult, folderRoute, target))
  }
  if (commands.length === 0) return { kind: 'noop' }
  if (commands.length === 1) return commands[0]
  return { kind: 'sequence', commands }
}

function resolveExternalFileRoute(
  dropResult: DropResult,
  route: ExternalFileDropRoute,
  target: SidebarDropData | null,
): SequentialDropCommand {
  if (route.kind === 'fileImport') return createFileImportCommand(dropResult, route.destination)
  if (!target) return { kind: 'blocked', reason: 'missing_data' }
  return {
    kind: 'surfaceFileImport',
    commandId: route.commandId,
    target,
    dropResult,
    label: route.label,
  }
}

function createFileImportCommand(
  dropResult: DropResult,
  destination: FileDropDestination,
): Extract<PlannedDropCommand, { kind: 'fileImport' }> {
  return {
    kind: 'fileImport',
    dropResult,
    destination,
    label: 'Import files',
  }
}

function surfaceCommandFeedback(
  command: Extract<PlannedDropCommand, { kind: 'surface' }>['command'],
) {
  switch (command.status) {
    case 'noop':
      return null
    case 'blocked':
      return { type: 'rejection' as const, reason: command.reason }
    case 'failed':
      return {
        type: 'rejection' as const,
        reason: command.rejectedItems[0]?.reason ?? 'unexpected_action',
      }
    case 'ready':
    case 'partial':
      return {
        type: 'operation' as const,
        action: command.action === 'noteEmbed' ? 'embed' : command.action,
        label: command.label,
      }
  }
}
