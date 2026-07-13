import type { ContentSessionState } from './content-session-contract'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type {
  ResourceAccessCommandGateway,
  ResourceBookmarkCommandGateway,
  ResourceStructureCommandGateway,
} from './resource-command-contract'
import type { ResourceIndexLoader, WorkspaceResourceIndex } from './resource-index-contract'

export type EditorRuntimeScope = Readonly<{
  campaignId: CampaignId
  actorId: CampaignMemberId
  projection: string
}>

export interface ResourceAccessGateway extends ResourceAccessCommandGateway {
  get(resourceId: ResourceId): unknown
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface ResourceBookmarkGateway extends ResourceBookmarkCommandGateway {
  get(resourceId: ResourceId): boolean | 'unknown'
}

export interface ResourcePreviewSource {
  get(resourceId: ResourceId): unknown
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface ResourceSessionSource {
  get(resourceId: ResourceId): ContentSessionState<unknown, unknown>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export interface ResourceNavigation {
  current(): ResourceId | null
  open(resourceId: ResourceId): void
}

export interface WorkspaceSearch {
  search(query: string): Promise<ReadonlyArray<ResourceId>>
}

export interface ReadonlyWorkspaceHistory {
  list(resourceId: ResourceId): Promise<ReadonlyArray<unknown>>
}

export interface WizardEditorRuntime {
  readonly scope: EditorRuntimeScope
  readonly resources: {
    readonly index: WorkspaceResourceIndex
    readonly loader: ResourceIndexLoader
    readonly structure: ResourceStructureCommandGateway
    readonly access: ResourceAccessGateway
    readonly bookmarks: ResourceBookmarkGateway
    readonly previews: ResourcePreviewSource
  }
  readonly content: {
    readonly notes: ResourceSessionSource
    readonly files: ResourceSessionSource
    readonly maps: ResourceSessionSource
    readonly canvases: ResourceSessionSource
  }
  readonly navigation: ResourceNavigation
  readonly search: WorkspaceSearch
  readonly history: ReadonlyWorkspaceHistory
}
