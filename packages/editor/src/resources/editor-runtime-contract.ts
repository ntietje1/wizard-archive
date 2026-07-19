import type {
  CanvasSessionSource,
  FileContentSource,
  MapSessionSource,
  NoteSessionSource,
} from './content-session-contract'
import type { CampaignMemberId, HistoryEntryId, NoteBlockId, ResourceId } from './domain-id'
import type { CanonicalTarget, SafeHttpsUrl } from './authored-destination-contract'
import type {
  CapabilityUnavailableReason,
  ResourceAccessCommandGateway,
  ResourceBookmarkCommandGateway,
  ResourceStructureRejection,
  ResourceStructureCommandGateway,
  NoteBlockAccessCommandGateway,
} from './resource-command-contract'
import type { ResourceAccessPresentation, ResourcePermission } from './resource-access-policy'
import type { NoteBlockAccessPresentation } from './note-block-access-policy'
import type {
  ResourceIndexLoader,
  ResourceKnowledge,
  ResourceProjectionScope,
  WorkspaceResourceIndex,
} from './resource-index-contract'
import type { VersionStamp } from './component-version'
import type { WorkspacePreferencesSource } from './workspace-preferences'
import type { ResourceUndoHistory } from './resource-undo-history'
import type { WorkspaceSearchOutcome } from './resource-search-policy'
import type { ReferenceGraphEdge } from './authored-destination'
import type { ResourceKind } from './resource-record'

export type ResourceCapability<T> =
  | { readonly status: 'available'; readonly value: T }
  | {
      readonly status: 'unavailable'
      readonly reason: 'capability_not_supported' | 'scope_unavailable' | 'unauthorized'
    }

export interface ResourceAccessGateway extends ResourceAccessCommandGateway {
  get(resourceId: ResourceId): ResourceKnowledge<ResourcePermission>
  getPresentation(resourceId: ResourceId): ResourceKnowledge<ResourceAccessPresentation>
  loadMorePresentation(resourceId: ResourceId): void
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface NoteBlockAccessGateway extends NoteBlockAccessCommandGateway {
  getPresentation(
    noteId: ResourceId,
    blockIds: ReadonlyArray<NoteBlockId>,
  ): ResourceKnowledge<NoteBlockAccessPresentation>
  loadMorePresentation(noteId: ResourceId, blockIds: ReadonlyArray<NoteBlockId>): void
  subscribe(
    noteId: ResourceId,
    blockIds: ReadonlyArray<NoteBlockId>,
    listener: () => void,
  ): () => void
}

export interface ResourceBookmarkGateway extends ResourceBookmarkCommandGateway {
  get(): ResourceKnowledge<ReadonlySet<ResourceId>>
  subscribe(listener: () => void): () => void
}

export type ResourcePreviewOutlineEntry = Readonly<{
  blockId: NoteBlockId
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
}>

export type ResourcePreview = Readonly<{
  kind: ResourceKind
  excerpt: string
  outline: ReadonlyArray<ResourcePreviewOutlineEntry>
}>

export type ResourcePreviewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{
      status: 'unavailable'
      reason: 'scope_unavailable' | 'unauthorized' | 'integrity_error'
    }>
  | Readonly<{ status: 'ready'; preview: ResourcePreview; imageUrl: SafeHttpsUrl | null }>

export interface ResourcePreviewSource {
  get(resourceId: ResourceId): ResourcePreviewState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export type ResourceReferenceDirection =
  | Readonly<{ status: 'ready'; edges: ReadonlyArray<ReferenceGraphEdge> }>
  | Readonly<{ status: 'capacity_exceeded' }>

export type ResourceReferenceState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{
      status: 'ready'
      outgoing: ResourceReferenceDirection
      backlinks: ResourceReferenceDirection
    }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'error' }>

export interface ResourceReferenceSource {
  get(resourceId: ResourceId): ResourceReferenceState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export type ResourceAssetsFolderResolution =
  | Readonly<{ status: 'completed'; resourceId: ResourceId }>
  | Readonly<{
      status: 'rejected'
      reason: ResourceStructureRejection | CapabilityUnavailableReason | 'integrity_error'
    }>

export interface ResourceAssetsFolderGateway {
  ensure(): Promise<ResourceAssetsFolderResolution>
}

export interface ResourceNavigation {
  current(): CanonicalTarget | null
  open(target: CanonicalTarget): void
  subscribe(listener: () => void): () => void
}

export interface WorkspaceSearch {
  search(query: string): Promise<WorkspaceSearchOutcome>
  recent(): ReadonlyArray<ResourceId>
  subscribeRecent(listener: () => void): () => void
  recordOpened(resourceId: ResourceId): void
}

export type ResourceHistoryEntry = Readonly<{
  id: HistoryEntryId
  resourceId: ResourceId
  actorId: CampaignMemberId
  createdAt: number
  version: VersionStamp
}>

export interface ReadonlyResourceHistory {
  list(resourceId: ResourceId): Promise<ReadonlyArray<ResourceHistoryEntry>>
}

export type EditorViewAsParticipant = Readonly<{
  id: CampaignMemberId
  displayName: string
  username: string
  imageUrl: string | null
}>

export interface EditorViewAsController {
  readonly pending: boolean
  readonly participants: ReadonlyArray<EditorViewAsParticipant>
  readonly selectedParticipantId: CampaignMemberId | null
  select(participantId: CampaignMemberId | null): void
}

export interface EditorRuntime {
  readonly scope: ResourceProjectionScope
  readonly resources: {
    readonly index: WorkspaceResourceIndex
    readonly loader: ResourceIndexLoader
    readonly structure: ResourceCapability<ResourceStructureCommandGateway>
    readonly access: ResourceCapability<ResourceAccessGateway>
    readonly noteBlockAccess: ResourceCapability<NoteBlockAccessGateway>
    readonly bookmarks: ResourceCapability<ResourceBookmarkGateway>
    readonly assets: ResourceCapability<ResourceAssetsFolderGateway>
    readonly previews: ResourceCapability<ResourcePreviewSource>
    readonly references: ResourceCapability<ResourceReferenceSource>
    readonly undo: ResourceCapability<ResourceUndoHistory>
  }
  readonly content: {
    readonly notes: NoteSessionSource
    readonly files: FileContentSource
    readonly maps: MapSessionSource
    readonly canvases: CanvasSessionSource
  }
  readonly navigation: ResourceNavigation
  readonly preferences: WorkspacePreferencesSource
  readonly search: ResourceCapability<WorkspaceSearch>
  readonly history: ResourceCapability<ReadonlyResourceHistory>
  readonly viewAs: ResourceCapability<EditorViewAsController>
}
