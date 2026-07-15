import type * as Y from 'yjs'
import type { VersionStamp } from './component-version'
import type { AssetId, CampaignMemberId, MapPinId, OperationId, ResourceId } from './domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  CreateResourceCommand,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { FileOwnedMetadata } from './file-content-contract'

export type ContentUnavailableReason =
  | 'capability_not_supported'
  | 'scope_unavailable'
  | 'unauthorized'

export type ContentIntegrityIssue = 'content_missing' | 'content_corrupt' | 'version_mismatch'

export type ContentUnavailableState =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly reason: ContentUnavailableReason }
  | { readonly status: 'integrity_error'; readonly issue: ContentIntegrityIssue }

export type ContentPendingState =
  | ContentUnavailableState
  | { readonly status: 'initializing'; readonly operationId: OperationId }

export type SessionAwareness =
  | { readonly status: 'unavailable' }
  | { readonly status: 'available'; readonly collaboratorIds: ReadonlyArray<CampaignMemberId> }

export type NoteSessionSaveResult =
  | { readonly status: 'completed'; readonly version: VersionStamp }
  | {
      readonly status: 'rejected'
      readonly reason:
        | 'content_corrupt'
        | 'content_missing'
        | 'resource_missing'
        | 'scope_unavailable'
        | 'unauthorized'
        | 'version_exhausted'
    }

export interface NoteSession {
  readonly document: Y.Doc
  readonly version: VersionStamp
  readonly awareness: SessionAwareness
  readonly readonly: boolean
  flush(): Promise<NoteSessionSaveResult>
  dispose(): void
}

export type FileResourceContent = FileOwnedMetadata &
  Readonly<{
    assetId: AssetId | null
  }>

export type MapResourceContent = Readonly<{
  imageAssetId: AssetId | null
  layers: ReadonlyArray<
    Readonly<{
      id: string
      imageAssetId: AssetId | null
      name: string
    }>
  >
  pins: ReadonlyArray<
    Readonly<{
      id: MapPinId
      targetResourceId: ResourceId
      layerId: string | null
      x: number
      y: number
      visible: boolean
    }>
  >
}>

export type NoteSessionState =
  | ContentUnavailableState
  | { readonly status: 'initializing'; readonly operationId: OperationId; readonly local: Y.Doc }
  | {
      readonly status: 'ready'
      readonly session: NoteSession
    }

export type FileContentState =
  | ContentPendingState
  | {
      readonly status: 'ready'
      readonly content: FileResourceContent
      readonly version: VersionStamp
    }

export type MapSessionState =
  | ContentPendingState
  | {
      readonly status: 'ready'
      readonly session: Readonly<{
        content: MapResourceContent
        version: VersionStamp
        awareness: SessionAwareness
      }>
    }

export type CanvasSessionState =
  | ContentPendingState
  | {
      readonly status: 'ready'
      readonly session: Readonly<{
        document: Y.Doc
        version: VersionStamp
        awareness: SessionAwareness
      }>
    }

export type CreateNoteResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'note'
}

export type CreateFileResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'file'
}

export type FileResourceSource = Readonly<{
  bytes: Uint8Array
  fileName: string
}>

export interface NoteSessionSource {
  get(resourceId: ResourceId): NoteSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: Y.Doc,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  dispose(): void
}

export interface FileContentSource {
  get(resourceId: ResourceId): FileContentState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  create(
    envelope: CommandEnvelope<CreateFileResourceCommand>,
    source: FileResourceSource,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  dispose(): void
}

export interface MapSessionSource {
  get(resourceId: ResourceId): MapSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  dispose(): void
}

export interface CanvasSessionSource {
  get(resourceId: ResourceId): CanvasSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  dispose(): void
}
