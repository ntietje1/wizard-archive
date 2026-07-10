import type { AnyItem } from '../workspace/items'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'
import type { SidebarDropData } from './drop-target-data'
import type { DropResult, FileDropDestination } from './file-drop'
import type { SurfaceDropCommand } from './surface-planner'
import type { DropRejectionReason } from './rejections'
import type { FileSystemIntentCommandPlan } from '../filesystem/domain/intent-planning'

export type DropInput = {
  clientX: number
  clientY: number
  ctrlKey?: boolean
  shiftKey?: boolean
}

export type DropPayload =
  | { kind: 'resources'; items: Array<AnyItem> }
  | { kind: 'externalFiles'; dropResult: DropResult }
  | { kind: 'externalUrl'; target: EmbedTarget }
  | { kind: 'rejectedExternalUrl'; reason: DropRejectionReason }

type NoopDropCommand = { kind: 'noop' }
type BlockedDropCommand = { kind: 'blocked'; reason: DropRejectionReason }
type OpenResourceDropCommand = { kind: 'openResource'; item: AnyItem; label: string }
type FileSystemDropCommand = {
  kind: 'filesystem'
  plan: FileSystemIntentCommandPlan
}
type SurfacePlannedDropCommand = { kind: 'surface'; command: SurfaceDropCommand }
type FileImportDropCommand = {
  kind: 'fileImport'
  dropResult: DropResult
  destination: FileDropDestination
  label: string
}
export type SurfaceFileImportCommandId =
  | 'surface-file-import.canvas'
  | 'surface-file-import.empty-embed'
  | 'surface-file-import.note-editor'
type SurfaceFileImportDropCommand = {
  kind: 'surfaceFileImport'
  commandId: SurfaceFileImportCommandId
  target: SidebarDropData
  dropResult: DropResult
  label: string
}
type SurfaceExternalUrlDropCommand = {
  kind: 'surfaceExternalUrl'
  commandId:
    | 'surface-url-drop.canvas'
    | 'surface-url-drop.empty-embed'
    | 'surface-url-drop.note-editor'
  target: SidebarDropData
  embedTarget: EmbedTarget
  label: string
}

type BasePlannedDropCommand =
  | NoopDropCommand
  | BlockedDropCommand
  | OpenResourceDropCommand
  | FileSystemDropCommand
  | SurfacePlannedDropCommand
  | FileImportDropCommand
  | SurfaceFileImportDropCommand
  | SurfaceExternalUrlDropCommand

export type SequentialDropCommand = Exclude<BasePlannedDropCommand, FileSystemDropCommand>

export type PlannedDropCommand =
  | BasePlannedDropCommand
  | { kind: 'sequence'; commands: Array<SequentialDropCommand> }
