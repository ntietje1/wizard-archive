import type {
  CanvasSessionSource,
  FileContentSource,
  MapResourceContent,
  MapSessionSource,
  NoteSessionSource,
} from './content-session-contract'
import type {
  CampaignMemberId,
  HistoryEntryId,
  NoteBlockId,
  ResourceId,
  SnapshotId,
} from './domain-id'
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

export type ItemHistoryActor = Readonly<{
  id: CampaignMemberId
  displayName: string
  imageUrl: string | null
}>

type ItemHistoryEntryBase<TAction extends string, TMetadata> = Readonly<{
  id: HistoryEntryId
  resourceId: ResourceId
  actor: ItemHistoryActor
  action: TAction
  metadata: TMetadata
  createdAt: number
}>

type ItemHistoryTimelineMetadata = {
  created: null
  copied: Readonly<{ sourceResourceId: ResourceId; sourceTitle: string }>
  renamed: Readonly<{ from: string; to: string }>
  moved: Readonly<{ from: string | null; to: string | null }>
  icon_changed: Readonly<{ from: string | null; to: string | null }>
  color_changed: Readonly<{ from: string | null; to: string | null }>
  trashed: null
  restored: null
  file_replaced: null
  file_removed: null
  access_changed: Readonly<{
    subject: 'all_players' | CampaignMemberId
    from: ResourcePermission
    to: ResourcePermission
  }>
  block_visibility_changed: Readonly<{
    blockCount: number
    subject: 'all_players' | CampaignMemberId
    visible: boolean
  }>
  inheritance_changed: Readonly<{ from: 'enabled' | 'disabled'; to: 'enabled' | 'disabled' }>
}

type ItemHistoryTimelineEntry = {
  [TAction in keyof ItemHistoryTimelineMetadata]: ItemHistoryEntryBase<
    TAction,
    ItemHistoryTimelineMetadata[TAction]
  >
}[keyof ItemHistoryTimelineMetadata]

export type ItemHistoryCheckpoint =
  | Readonly<{
      kind: 'note' | 'canvas'
      snapshotId: SnapshotId
      version: VersionStamp
    }>
  | Readonly<{
      kind: 'map'
      snapshotId: SnapshotId
      version: VersionStamp
    }>

type ItemHistoryMapActionMetadata = {
  map_image_changed: Readonly<{ layerId: string | null }>
  map_image_removed: Readonly<{ layerId: string | null }>
  map_pin_added: Readonly<{ pinLabel: string }>
  map_pin_moved: Readonly<{ pinLabel: string }>
  map_pin_removed: Readonly<{ pinLabel: string }>
  map_pin_visibility_changed: Readonly<{ pinLabel: string; visible: boolean }>
}

type ItemHistoryMapEntry = {
  [TAction in keyof ItemHistoryMapActionMetadata]: ItemHistoryEntryBase<
    TAction,
    ItemHistoryMapActionMetadata[TAction]
  > &
    Readonly<{ checkpoint: Extract<ItemHistoryCheckpoint, { kind: 'map' }> }>
}[keyof ItemHistoryMapActionMetadata]

export type ItemHistoryEntry =
  | ItemHistoryTimelineEntry
  | (ItemHistoryEntryBase<'content_edited', null> &
      Readonly<{
        checkpoint: Extract<ItemHistoryCheckpoint, { kind: 'note' | 'canvas' }>
      }>)
  | (ItemHistoryEntryBase<
      'content_restored',
      Readonly<{
        restoredFromEntryId: HistoryEntryId
        preservedSnapshotId: SnapshotId
      }>
    > &
      Readonly<{ checkpoint: ItemHistoryCheckpoint }>)
  | ItemHistoryMapEntry

export type ItemHistoryListState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<ItemHistoryEntry>
      pagination: 'complete' | 'more_available' | 'loading_more'
    }>

export type ItemHistoryPreview =
  | Readonly<{
      kind: 'note' | 'canvas'
      snapshotId: SnapshotId
      version: VersionStamp
      update: Uint8Array
    }>
  | Readonly<{
      kind: 'map'
      snapshotId: SnapshotId
      version: VersionStamp
      content: MapResourceContent
    }>

export type ItemHistoryPreviewState =
  | Readonly<{ status: 'closed' }>
  | Readonly<{ status: 'loading'; entryId: HistoryEntryId; entryTime: number }>
  | Readonly<{
      status: 'unavailable' | 'error'
      entryId: HistoryEntryId
      entryTime: number
    }>
  | Readonly<{
      status: 'ready'
      entryId: HistoryEntryId
      entryTime: number
      preview: ItemHistoryPreview
    }>

export type ItemHistoryRestoreState =
  | Readonly<{ status: 'closed' }>
  | Readonly<{ status: 'loading'; entryId: HistoryEntryId }>
  | Readonly<{ status: 'ready'; entryId: HistoryEntryId; entryTime: number }>
  | Readonly<{ status: 'restoring'; entryId: HistoryEntryId; entryTime: number }>
  | Readonly<{ status: 'error'; entryId: HistoryEntryId; entryTime: number }>

export type ItemHistoryRestoreResult =
  | Readonly<{
      status: 'restored'
      historyEntryId: HistoryEntryId
      preservedSnapshotId: SnapshotId
      restoredFromEntryId: HistoryEntryId
    }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'content_changed'
        | 'history_entry_unavailable'
        | 'resource_unavailable'
        | 'snapshot_incompatible'
        | 'snapshot_unavailable'
        | 'unauthorized'
    }>
  | Readonly<{ status: 'unavailable' | 'failed' }>

export type ItemHistoryState = Readonly<{
  list: ItemHistoryListState
  preview: ItemHistoryPreviewState
  restore: ItemHistoryRestoreState
}>

export interface ItemHistoryController {
  get(resourceId: ResourceId): ItemHistoryState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
  loadMore(resourceId: ResourceId): void
  selectPreview(resourceId: ResourceId, entryId: HistoryEntryId | null): void
  requestRestore(resourceId: ResourceId, entryId: HistoryEntryId): void
  cancelRestore(resourceId: ResourceId): void
  confirmRestore(resourceId: ResourceId): Promise<ItemHistoryRestoreResult>
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
  readonly history: ResourceCapability<ItemHistoryController>
  readonly viewAs: ResourceCapability<EditorViewAsController>
}
