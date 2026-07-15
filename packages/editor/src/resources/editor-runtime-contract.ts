import type {
  CanvasSessionSource,
  FileContentSource,
  MapSessionSource,
  NoteSessionSource,
} from './content-session-contract'
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

export type ResourceCapability<T> =
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
  get(resourceId: ResourceId): ResourceKnowledge<AssetId | null>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

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
  list(resourceId: ResourceId): Promise<ReadonlyArray<ResourceHistoryEntry>>
}

export interface EditorRuntime {
  readonly scope: ResourceProjectionScope
  readonly resources: {
    readonly index: WorkspaceResourceIndex
    readonly loader: ResourceIndexLoader
    readonly structure: ResourceCapability<ResourceStructureCommandGateway>
    readonly access: ResourceCapability<ResourceAccessGateway>
    readonly bookmarks: ResourceCapability<ResourceBookmarkGateway>
    readonly previews: ResourceCapability<ResourcePreviewSource>
  }
  readonly content: {
    readonly notes: NoteSessionSource
    readonly files: FileContentSource
    readonly maps: MapSessionSource
    readonly canvases: CanvasSessionSource
  }
  readonly navigation: ResourceNavigation
  readonly search: ResourceCapability<WorkspaceSearch>
  readonly history: ResourceCapability<ReadonlyResourceHistory>
}
