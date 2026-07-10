import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { DropRejectionReason } from './rejections'
import type { FileDropDestination } from './file-drop'
import type { SidebarDropData } from './drop-target-data'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
} from './drop-target-data'
import type { SurfaceFileImportCommandId } from './drop-command'

export type ExternalFileDropRoute =
  | { kind: 'fileImport'; destination: FileDropDestination }
  | {
      kind: 'surfaceFileImport'
      commandId: SurfaceFileImportCommandId
      label: string
    }

export type ExternalFileDropTargetCapability =
  | { kind: 'blocked'; reason: DropRejectionReason }
  | {
      kind: 'accepted'
      files: ExternalFileDropRoute | null
      browserFolders: ExternalFileDropRoute | null
    }

export function resolveExternalFileDropTarget(
  target: SidebarDropData | null,
  {
    surfaceFileUploadAvailable = true,
  }: {
    surfaceFileUploadAvailable?: boolean
  } = {},
): ExternalFileDropTargetCapability {
  if (!target) return directFileImport(null)

  switch (target.type) {
    case CANVAS_DROP_ZONE_TYPE:
      if (!surfaceFileUploadAvailable) return unsupportedTarget()
      return {
        kind: 'accepted',
        files: {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.canvas',
          label: 'Upload to canvas',
        },
        browserFolders: assetsFileImport(),
      }
    case EMPTY_EMBED_DROP_TYPE:
      if (!surfaceFileUploadAvailable) return unsupportedTarget()
      return {
        kind: 'accepted',
        files: {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.empty-embed',
          label: 'Upload to embed',
        },
        browserFolders: assetsFileImport(),
      }
    case NOTE_EDITOR_DROP_TYPE:
      if (!surfaceFileUploadAvailable) return unsupportedTarget()
      return {
        kind: 'accepted',
        files: {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.note-editor',
          label: 'Add file embeds to note',
        },
        browserFolders: assetsFileImport(),
      }
    case EMPTY_EDITOR_DROP_TYPE:
      return acceptedFileImport({ kind: 'assets' })
    case SIDEBAR_ROOT_DROP_TYPE:
      return directFileImport(null)
    case TRASH_DROP_ZONE_TYPE:
      return unsupportedTarget()
    case RESOURCE_TYPES.folders:
      return target.isTrashed ? unsupportedTarget() : directFileImport(target.id)
    default:
      return unsupportedTarget()
  }
}

export function canAcceptExternalFileDropTarget(capability: ExternalFileDropTargetCapability) {
  return capability.kind === 'accepted' && Boolean(capability.files || capability.browserFolders)
}

function directFileImport(parentId: Extract<FileDropDestination, { kind: 'direct' }>['parentId']) {
  return acceptedFileImport({ kind: 'direct', parentId })
}

function assetsFileImport(): ExternalFileDropRoute {
  return { kind: 'fileImport', destination: { kind: 'assets' } }
}

function acceptedFileImport(destination: FileDropDestination): ExternalFileDropTargetCapability {
  const route: ExternalFileDropRoute = { kind: 'fileImport', destination }
  return { kind: 'accepted', files: route, browserFolders: route }
}

function unsupportedTarget() {
  return { kind: 'blocked' as const, reason: 'unsupported_target' as const }
}
