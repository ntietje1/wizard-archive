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
import type { FileOwnedMetadata } from './file-content-contract'

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
  list(resourceId: ResourceId): Promise<ReadonlyArray<ResourceHistoryEntry>>
}

export interface WizardEditorRuntime {
  readonly scope: ResourceProjectionScope
  readonly resources: {
    readonly index: WorkspaceResourceIndex
    readonly loader: ResourceIndexLoader
    readonly structure: ResourceStructureCommandGateway
    readonly access: ResourceCapability<ResourceAccessGateway>
    readonly bookmarks: ResourceCapability<ResourceBookmarkGateway>
    readonly previews: ResourceCapability<ResourcePreviewSource>
  }
  readonly content: {
    readonly notes: NoteContentSource<Y.Doc, Y.Doc>
    readonly files: ResourceContentSource<null, FileResourceContent>
    readonly maps: ResourceContentSource<null, MapResourceContent>
    readonly canvases: ResourceContentSource<null, Y.Doc>
  }
  readonly navigation: ResourceNavigation
  readonly search: ResourceCapability<WorkspaceSearch>
  readonly history: ResourceCapability<ReadonlyResourceHistory>
}
