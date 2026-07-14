import type * as Y from 'yjs'
import type { NoteContentSource, ResourceContentSource } from './content-session-contract'
import type { AssetId, CampaignMemberId, HistoryEntryId, ResourceId } from './domain-id'
import type {
  ResourceAccessCommandGateway,
  ResourceBookmarkCommandGateway,
  ResourcePermission,
  ResourceStructureCommandGateway,
} from './resource-command-contract'
import type {
  ResourceIndexLoader,
  ResourceKnowledge,
  ResourceProjectionScope,
  WorkspaceResourceIndex,
} from './resource-index-contract'
import type { VersionStamp } from './component-version'

export type ResourceCapabilityState<T> =
  | { readonly status: 'available'; readonly value: T }
  | {
      readonly status: 'unavailable'
      readonly reason: 'capability_not_supported' | 'scope_unavailable' | 'unauthorized'
    }

export interface ResourceAccessGateway extends ResourceAccessCommandGateway {
  get(resourceId: ResourceId): ResourceKnowledge<ResourcePermission>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface ResourceBookmarkGateway extends ResourceBookmarkCommandGateway {
  get(resourceId: ResourceId): ResourceKnowledge<boolean>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface ResourcePreviewSource {
  get(resourceId: ResourceId): ResourceCapabilityState<AssetId | null>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export type FileResourceContent = Readonly<{
  assetId: AssetId | null
  extension: string | null
  mediaType: string
  originalName: string | null
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
      id: string
      targetResourceId: ResourceId
      layerId: string | null
      x: number
      y: number
      visible: boolean
    }>
  >
}>

export interface ResourceNavigation {
  current(): ResourceId | null
  open(resourceId: ResourceId): void
  subscribe(listener: () => void): () => void
}

export interface WorkspaceSearch {
  search(query: string): Promise<ReadonlyArray<ResourceId>>
}

export type ResourceHistoryEntry = Readonly<{
  id: HistoryEntryId
  resourceId: ResourceId
  actorId: CampaignMemberId
  createdAt: number
  version: VersionStamp
}>

export interface ReadonlyResourceHistory {
  list(
    resourceId: ResourceId,
  ): Promise<ResourceCapabilityState<ReadonlyArray<ResourceHistoryEntry>>>
}

export interface WizardEditorRuntime {
  readonly scope: ResourceProjectionScope
  readonly resources: {
    readonly index: WorkspaceResourceIndex
    readonly loader: ResourceIndexLoader
    readonly structure: ResourceStructureCommandGateway
    readonly access: ResourceAccessGateway
    readonly bookmarks: ResourceBookmarkGateway
    readonly previews: ResourcePreviewSource
  }
  readonly content: {
    readonly notes: NoteContentSource<Y.Doc, Y.Doc>
    readonly files: ResourceContentSource<null, FileResourceContent>
    readonly maps: ResourceContentSource<null, MapResourceContent>
    readonly canvases: ResourceContentSource<null, Y.Doc>
  }
  readonly navigation: ResourceNavigation
  readonly search: WorkspaceSearch
  readonly history: ReadonlyResourceHistory
}
