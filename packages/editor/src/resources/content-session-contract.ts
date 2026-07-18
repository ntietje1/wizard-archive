import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { AuthoredDestination } from './authored-destination-contract'
import type { Sha256Digest, VersionStamp } from './component-version'
import type { CampaignMemberId, MapPinId, OperationId, ResourceId } from './domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  CreateResourceCommand,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { FileOwnedMetadata } from './file-content-contract'
import type { SourcePathAlias } from './resource-catalog-contract'

export type ContentUnavailableReason =
  | 'capability_not_supported'
  | 'scope_unavailable'
  | 'unauthorized'

export type ContentIntegrityIssue =
  | 'content_missing'
  | 'content_corrupt'
  | 'content_limit_exceeded'
  | 'version_exhausted'
  | 'version_mismatch'

export type ContentUnavailableState =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly reason: ContentUnavailableReason }
  | { readonly status: 'integrity_error'; readonly issue: ContentIntegrityIssue }

export type ContentPendingState =
  | ContentUnavailableState
  | { readonly status: 'initializing'; readonly operationId: OperationId }

export type ContentExportResult =
  | ContentUnavailableState
  | Readonly<{
      status: 'ready'
      bytes: Uint8Array
      extension: string
      mediaType: string
    }>

export type SessionAwareness =
  | { readonly status: 'unavailable' }
  | { readonly status: 'available'; readonly collaboratorIds: ReadonlyArray<CampaignMemberId> }

export type CollaborationUser = Readonly<{
  name: string
  color: string
}>

export type ContentCollaboration = Readonly<{
  provider: Readonly<{ awareness: Awareness }>
  user: CollaborationUser
}>

export type ContentSessionSaveResult =
  | { readonly status: 'completed'; readonly version: VersionStamp }
  | {
      readonly status: 'rejected'
      readonly reason:
        | 'content_corrupt'
        | 'content_limit_exceeded'
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
  readonly collaboration: ContentCollaboration
  readonly flush: () => Promise<ContentSessionSaveResult>
  dispose(): void
}

export interface CanvasSession {
  readonly document: Y.Doc
  readonly version: VersionStamp
  readonly awareness: SessionAwareness
  readonly collaboration: ContentCollaboration
  readonly flush: () => Promise<ContentSessionSaveResult>
  dispose(): void
}

export type FileResourceContent = FileOwnedMetadata &
  Readonly<{
    attachment: 'attached' | 'unattached'
  }>

export type FileContentReplaceResult =
  | Readonly<{
      status: 'completed'
      content: FileResourceContent
      version: VersionStamp
    }>
  | Readonly<{
      status: 'retryable'
      reason: 'content_initializing' | 'response_lost'
    }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'content_corrupt'
        | 'content_missing'
        | 'invalid_file'
        | 'resource_missing'
        | 'unauthorized'
        | 'version_conflict'
        | 'version_exhausted'
    }>

export type MapImageAttachment =
  | Readonly<{ status: 'unattached' }>
  | Readonly<{
      status: 'attached'
      byteSize: number
      digest: Sha256Digest
      mediaType: string
    }>

export type MapResourceContent = Readonly<{
  image: MapImageAttachment
  layers: ReadonlyArray<
    Readonly<{
      id: string
      image: MapImageAttachment
      name: string
    }>
  >
  pins: ReadonlyArray<
    Readonly<{
      id: MapPinId
      destination: AuthoredDestination
      layerId: string | null
      x: number
      y: number
      visible: boolean
    }>
  >
}>

export type MapContentMutationResult =
  | Readonly<{
      status: 'completed'
      content: MapResourceContent
      version: VersionStamp
    }>
  | Readonly<{
      status: 'retryable'
      reason: 'content_initializing' | 'response_lost'
    }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'content_corrupt'
        | 'content_missing'
        | 'invalid_command'
        | 'layer_missing'
        | 'operation_id_reused'
        | 'pin_missing'
        | 'resource_missing'
        | 'target_missing'
        | 'unauthorized'
        | 'version_conflict'
        | 'version_exhausted'
    }>

export type MapContentCommand =
  | Readonly<{
      type: 'createPins'
      pins: ReadonlyArray<
        Readonly<{
          id: MapPinId
          destination: AuthoredDestination
          layerId: string | null
          x: number
          y: number
        }>
      >
    }>
  | Readonly<{ type: 'movePin'; pinId: MapPinId; x: number; y: number }>
  | Readonly<{ type: 'setPinVisibility'; pinId: MapPinId; visible: boolean }>
  | Readonly<{ type: 'removePin'; pinId: MapPinId }>

export function isMapPosition(position: { x: number; y: number }): boolean {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.x <= 100 &&
    position.y >= 0 &&
    position.y <= 100
  )
}

export interface MapSession {
  readonly content: MapResourceContent
  readonly version: VersionStamp
  readonly awareness: SessionAwareness
  execute(command: MapContentCommand): Promise<MapContentMutationResult>
  loadImage(layerId: string | null): Promise<ContentExportResult>
  replaceImage(
    layerId: string | null,
    expectedVersion: VersionStamp,
    source: FileResourceSource,
  ): Promise<MapContentMutationResult>
  dispose(): void
}

export interface MapPreview {
  readonly content: MapResourceContent
  readonly version: VersionStamp
  loadImage(layerId: string | null): Promise<ContentExportResult>
}

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
      readonly session: MapSession
    }

export type MapPreviewState =
  | ContentUnavailableState
  | {
      readonly status: 'ready'
      readonly preview: MapPreview
    }

export type CanvasSessionState =
  | ContentPendingState
  | {
      readonly status: 'ready'
      readonly session: CanvasSession
    }

export type CanvasPreviewState =
  | ContentUnavailableState
  | {
      readonly status: 'ready'
      readonly document: Y.Doc
      readonly version: VersionStamp
    }

export interface CanvasPreviewSource {
  get(resourceId: ResourceId): CanvasPreviewState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export type CreateNoteResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'note'
}

export type CreateFileResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'file'
}

export type CreateMapResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'map'
}

export type CreateCanvasResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'canvas'
}

export type FileResourceSource = Readonly<{
  bytes: Uint8Array
  fileName: string
}>

export type FileResourceCreationSource = FileResourceSource &
  Readonly<{
    alias: SourcePathAlias
    metadataVersion: VersionStamp
  }>

export interface NoteSessionSource {
  get(resourceId: ResourceId): NoteSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  export(resourceId: ResourceId): ContentExportResult | Promise<ContentExportResult>
  create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: Y.Doc,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  dispose(): void
}

export interface FileContentSource {
  get(resourceId: ResourceId): FileContentState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  export(resourceId: ResourceId): ContentExportResult | Promise<ContentExportResult>
  create(
    envelope: CommandEnvelope<CreateFileResourceCommand>,
    source: FileResourceCreationSource,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  replace(
    resourceId: ResourceId,
    expectedVersion: VersionStamp,
    source: FileResourceSource,
  ): Promise<FileContentReplaceResult>
  dispose(): void
}

export interface MapSessionSource {
  readonly previews: MapPreviewSource
  get(resourceId: ResourceId): MapSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  export(resourceId: ResourceId): ContentExportResult | Promise<ContentExportResult>
  create(
    envelope: CommandEnvelope<CreateMapResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  dispose(): void
}

export interface MapPreviewSource {
  get(resourceId: ResourceId): MapPreviewState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface CanvasSessionSource {
  readonly previews: CanvasPreviewSource
  get(resourceId: ResourceId): CanvasSessionState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  export(resourceId: ResourceId): ContentExportResult | Promise<ContentExportResult>
  create(
    envelope: CommandEnvelope<CreateCanvasResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
  dispose(): void
}
