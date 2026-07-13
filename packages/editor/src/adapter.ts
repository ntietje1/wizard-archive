import { createWorkspaceFileSystemOperations } from './filesystem/operation-construction'
import { useWorkspaceResourceCommandRuntime } from './filesystem/operation-adapter'
import { createCatalogItemLink } from './filesystem/catalog-links'
import {
  createCatalogFileSystemSearch,
  createCatalogItemSearchResult,
  createResourceCatalogModel,
} from './filesystem/catalog'
import {
  createStaticCatalogFileSystemSearch,
  useHydratedCatalogFileSystemSearch,
} from './filesystem/search'
import {
  createStaticCatalogFileSystemResourceContentSource,
  useHydratedCatalogFileSystemResourceContentSource,
} from './filesystem/resource-content-source'
import { createCatalogFileSystemDownload } from './filesystem/download'
import { createResourceFileSystemHistory, resolveResourceHistoryScope } from './filesystem/history'
import type { EditHistoryEntry, HistoryRollbackResult } from './filesystem/history-contract'
import {
  createActorFileSystemPermissions,
  filterFileSystemItemsForActor,
  resolveWorkspaceModeForItem,
} from './filesystem/access'
import {
  createResourceAvailabilityMetadataSource,
  resolveResourceAvailabilityState,
} from './filesystem/domain/availability-state'
import {
  createWorkspaceResource,
  createWorkspaceRuntime,
  getWorkspaceResourceId,
  getWorkspaceNavigationCurrentResourceId,
  resolveWorkspaceNavigationState,
} from './workspace/runtime'
import type { MaybePromise } from '../../../shared/common/async'
import type { NoteProjectionResult } from '../../../shared/yjs-sync/note-projection'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc, Map as YMap } from 'yjs'
import type {
  EditHistoryId,
  MapPinId as InternalMapPinId,
  SidebarItemId as InternalResourceItemId,
  WorkspaceMemberId as InternalParticipantId,
} from '../../../shared/common/ids'
import type { BlockSearchResult } from '../../../shared/search/types'
import { isPersistedResourceId, parseResourceSlug } from './workspace/resource-contract'
import type {
  ResourceByKind,
  ResourceId,
  ResourceKind,
  ResourceSlug,
  ResourceWithContentByKind,
} from './workspace/resource-contract'
import type {
  WorkspaceNavigationResult,
  WorkspaceNavigationState,
  WorkspaceResource,
  WorkspaceRuntime,
} from './workspace/runtime'
import type { WorkspaceResourceReadModel } from './workspace/items'
import {
  createCanvasEmbeddedSessionPorts,
  createCanvasSessionPorts,
} from './canvas/workspace-session-source'
import { useEmbeddedCanvasStateFromUpdates } from './canvas/embedded-state'
import { useCanvasDocumentSession } from './canvas/use-document-session'
import type { FileItem, FileItemWithContent } from './files/item-contract'
import type { ResourceImportContentInitializers, ResourceImportFile } from './files/import-contract'
import { runPdfPreviewGeneration } from './files/pdf-preview-generation'
import { planMapPinCreations } from './game-maps/document-contract'
import { resolveMapImage } from './game-maps/image-resolution'
import type { MapImageSource } from './game-maps/image-resolution'
import { replaceMapImage } from './game-maps/map-image-replacement'
import {
  completedResourceCommand,
  isResourceCatalogCommand,
  isResourceSharingCommand,
  RESOURCE_COMMAND_TYPE,
  RESOURCE_EVENT_TYPE,
} from './filesystem/transaction-contract'
import type {
  ResourceCatalogCommand,
  ResourceCommand,
  ResourceCommandExecutionOptions,
  ResourceCommandResult,
  ResourceCreateCommand,
  ResourceCreateParentPlan,
  ResourceEvent,
  ResourceOperationResult,
  ResourceRenameCommand,
  ResourceSharingCommand,
  ResourceTransactionReceipt,
} from './filesystem/transaction-contract'
import type {
  FileSystemDownload,
  FileSystemDownloadItem,
  FileSystemDownloadResult,
} from './filesystem/download'
import type { ResourceCatalog, ResourceOperationItems } from './filesystem/catalog'
import type { FileSystemPaths } from './filesystem/catalog-paths'
import type { FileSystemLoadState } from './filesystem/load-state'
import type { FileSystemPermissions } from './filesystem/permissions'
import type {
  EditorShareParticipant,
  EditorShareParticipantId,
  ResourceShareSource,
  UnsupportedSharingSource,
  WizardEditorSharingSource,
} from './sharing/contracts'
import type { FileSystemSearch } from './filesystem/search'
import type { ResourceContentSource } from './filesystem/resource-content-source'
import type { FileSystemOperations } from './filesystem/operations'
import type { FileSystemSelection } from './filesystem/selection'
import type {
  ResourceClipboardDriver,
  ResourceCommandCapabilities,
  ResourceDropDriver,
  ResourceHistoryOperationDriver,
  ResourceIoCapabilities,
  ResourceOperationDriver,
  ResourceCommandDriver,
  ResourceCommandRuntime,
  ResourceCommandRuntimeArgs,
  ResourceTrashDriver,
} from './filesystem/operation-runtime-contract'
import { createResourceCommandDrivers } from './filesystem/item-command-operations'
import type { MapItemWithContent } from './game-maps/item-contract'
import { createCanvasDocumentDoc, readCanvasDocumentContent } from './canvas/document-contract'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './canvas/document-contract'
import type { CanvasItemWithContent } from './canvas/item-contract'
import type { GameMapSnapshotData } from './game-maps/document-contract'
import { executeFileIoCommand } from './files/io-command'
import type { WorkspaceMode } from '../../../shared/workspace/workspace-mode'
import { RESOURCE_TYPES } from './workspace/items-persistence-contract'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { ItemSearchResult } from './search/model'
import { useYjsCollaborationSession } from './collaboration/yjs-session'
import type {
  YjsCollaborationAwarenessEntry,
  YjsCollaborationSession,
  YjsCollaborationSourceHook,
  YjsCollaborationUpdateEntry,
  YjsSessionBeforeDestroyInput,
  YjsSessionTransport,
} from './collaboration/yjs-session'
import type { YjsCollaborationProvider, YjsProviderUser } from './collaboration/yjs-provider'
import { useNoteYjsPersistenceLifecycle } from './notes/yjs-persistence'
import type { Heading, PartialNoteBlock } from './notes/document/model'
import type { NoteValueRuntimeState } from './notes/values-contract'
import {
  createImportedTextNotePayload,
  createNoteYDocFromContent,
  createPlainTextNoteContent,
  readNoteYDocMarkdown,
} from './notes/imported-text'
import type { ImportedTextNotePayload } from './notes/imported-text'

type ResourceItemId = string
type WizardEditorInternalDocumentSource = WorkspaceRuntime['sessions']
type InternalCatalogItemLinkRow = Omit<WizardEditorCatalogItemLinkRow, 'item'> & {
  item: { id: InternalResourceItemId; name: string } | null
}

export interface WizardEditorWorkspaceSource {
  id: string
  instanceId?: string
}

export interface WizardEditorResource {
  kind: 'resource'
  uri: WorkspaceResource['uri']
}

export type WizardEditorSortOrder = 'Alphabetical' | 'DateCreated' | 'DateModified'

export type WizardEditorSortDirection = 'Ascending' | 'Descending'

export type WizardEditorSortOptions = {
  order: WizardEditorSortOrder
  direction: WizardEditorSortDirection
}

export const WIZARD_EDITOR_DEFAULT_SORT_OPTIONS: WizardEditorSortOptions = {
  order: 'DateCreated',
  direction: 'Descending',
}

export type WizardEditorResourceSlug = string & { readonly __brand: 'ResourceSlug' }

export type WizardEditorItem = ResourceByKind<ResourceKind>
export type WizardEditorItemWithContent = ResourceWithContentByKind<ResourceKind>
export type WizardEditorFolderItem = ResourceByKind<typeof RESOURCE_TYPES.folders>
export type WizardEditorFolderItemWithContent = ResourceWithContentByKind<
  typeof RESOURCE_TYPES.folders
>
export type WizardEditorResourceCommand = ResourceCommand & {}
export type WizardEditorResourceCatalogCommand = ResourceCatalogCommand & {}
export type WizardEditorResourceSharingCommand = ResourceSharingCommand & {}
export type WizardEditorResourceCommandExecutionOptions = ResourceCommandExecutionOptions & {}
export type WizardEditorResourceCommandResult<TConflict = unknown> =
  ResourceCommandResult<TConflict>
export type WizardEditorResourceCreateCommand = ResourceCreateCommand & {}
export type WizardEditorResourceCreateParentPlan = ResourceCreateParentPlan & {}
export type WizardEditorResourceRenameCommand = ResourceRenameCommand & {}
export type WizardEditorResourceEvent = ResourceEvent & {}
export type WizardEditorResourceCommandCompletionOptions = {
  transactionId?: string | null
  undoable?: boolean
}
export const WIZARD_EDITOR_RESOURCE_COMMAND_TYPE = {
  create: RESOURCE_COMMAND_TYPE.create,
  rename: RESOURCE_COMMAND_TYPE.rename,
  move: RESOURCE_COMMAND_TYPE.move,
  copy: RESOURCE_COMMAND_TYPE.copy,
  trash: RESOURCE_COMMAND_TYPE.trash,
  restore: RESOURCE_COMMAND_TYPE.restore,
  deleteForever: RESOURCE_COMMAND_TYPE.deleteForever,
  emptyTrash: RESOURCE_COMMAND_TYPE.emptyTrash,
  setResourceAudiencePermission: RESOURCE_COMMAND_TYPE.setResourceAudiencePermission,
  setResourcesMemberPermission: RESOURCE_COMMAND_TYPE.setResourcesMemberPermission,
  clearResourcesMemberPermission: RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission,
  setFolderInheritShares: RESOURCE_COMMAND_TYPE.setFolderInheritShares,
  setBlocksShareStatus: RESOURCE_COMMAND_TYPE.setBlocksShareStatus,
  setBlockMemberPermission: RESOURCE_COMMAND_TYPE.setBlockMemberPermission,
  toggleBookmarks: RESOURCE_COMMAND_TYPE.toggleBookmarks,
} as const satisfies Record<string, WizardEditorResourceCommand['type']>
export const WIZARD_EDITOR_RESOURCE_EVENT_TYPE = {
  created: RESOURCE_EVENT_TYPE.created,
  updated: RESOURCE_EVENT_TYPE.updated,
  renamed: RESOURCE_EVENT_TYPE.renamed,
  moved: RESOURCE_EVENT_TYPE.moved,
  copied: RESOURCE_EVENT_TYPE.copied,
  trashed: RESOURCE_EVENT_TYPE.trashed,
  restored: RESOURCE_EVENT_TYPE.restored,
  replaced: RESOURCE_EVENT_TYPE.replaced,
  mergedFolder: RESOURCE_EVENT_TYPE.mergedFolder,
  deletedForever: RESOURCE_EVENT_TYPE.deletedForever,
  skipped: RESOURCE_EVENT_TYPE.skipped,
  noop: RESOURCE_EVENT_TYPE.noop,
} as const satisfies Record<string, WizardEditorResourceEvent['type']>
export type WizardEditorWorkspaceActor =
  | { kind: 'owner' }
  | { kind: 'participant' }
  | { kind: 'owner_view_as'; participantId: EditorShareParticipantId }

export type WizardEditorResourceAvailabilitySubject = 'item' | 'page'

export type WizardEditorResourceAvailabilityLookup =
  | { kind: 'id'; id: ResourceId | null | undefined }
  | { kind: 'slug'; slug: string | null | undefined }

interface WizardEditorResourceAvailabilityMetadataLookup {
  getItemById: (itemId: ResourceId) => WizardEditorItem | null | undefined
  getItemBySlug: (slug: string) => WizardEditorItem | null | undefined
}

export interface WizardEditorResourceAvailabilityMetadataSource {
  owner: WizardEditorResourceAvailabilityMetadataLookup
  participant: WizardEditorResourceAvailabilityMetadataLookup
  status: 'pending' | 'error' | 'success'
}

export type WizardEditorResourceAvailabilityState =
  | {
      status: 'loading'
      label: string
      item?: undefined
      message?: undefined
    }
  | {
      status: 'available'
      label: string
      item: WizardEditorItemWithContent
      message?: undefined
    }
  | {
      status: 'not_found'
      label: string
      item?: undefined
      message: string
    }
  | {
      status: 'trashed' | 'not_shared' | 'error'
      label: string
      item?: undefined
      message: string
    }

interface WizardEditorItemReadState<T extends WizardEditorItem> {
  data: Array<T>
  readModel: WorkspaceResourceReadModel<T>
  status: 'pending' | 'error' | 'success'
  error: Error | null
  refresh: () => Promise<unknown>
}

export function filterWizardEditorItemsForActor<T extends WizardEditorItem>(
  activeItems: WizardEditorItemReadState<T>,
  actor: WizardEditorWorkspaceActor | null,
): WizardEditorItemReadState<T> {
  return filterFileSystemItemsForActor(activeItems, actor) as WizardEditorItemReadState<T>
}

export function isPersistedWizardEditorItemId(itemId: string | null | undefined): itemId is string {
  return isPersistedResourceId(itemId)
}

export function isPersistedWizardEditorItem<Item extends Pick<WizardEditorItem, 'id'>>(
  item: Item | null | undefined,
): item is Item {
  return item !== null && item !== undefined && isPersistedWizardEditorItemId(item.id)
}

export function isWizardEditorItemWithContent(
  item: WizardEditorItem | null | undefined,
): item is WizardEditorItemWithContent {
  return item !== null && item !== undefined && 'ancestors' in item && Array.isArray(item.ancestors)
}

export function isWizardEditorFileItem(
  item: WizardEditorItem | null | undefined,
): item is ResourceByKind<typeof RESOURCE_TYPES.files> {
  return item?.type === RESOURCE_TYPES.files
}

export function isWizardEditorFileItemType(value: string | null | undefined): boolean {
  return value === RESOURCE_TYPES.files
}

export function isWizardEditorGameMapItemType(value: string | null | undefined): boolean {
  return value === RESOURCE_TYPES.gameMaps
}

export function isWizardEditorGameMapItem(
  item: WizardEditorItem | null | undefined,
): item is ResourceByKind<typeof RESOURCE_TYPES.gameMaps> {
  return item?.type === RESOURCE_TYPES.gameMaps
}

export function readWizardEditorGameMapPinnedItemIds(
  item: WizardEditorItem | null | undefined,
): Array<ResourceId> | null {
  const pins = readWizardEditorGameMapPins(item)
  return pins ? pins.map((pin) => pin.itemId) : null
}

export function hasWizardEditorGameMapPin(
  item: WizardEditorItem | null | undefined,
  mapPinId: InternalMapPinId,
): boolean {
  const pins = readWizardEditorGameMapPins(item)
  return pins ? pins.some((pin) => pin.id === mapPinId) : false
}

export function isWizardEditorNoteItem(
  item: WizardEditorItem | null | undefined,
): item is ResourceByKind<typeof RESOURCE_TYPES.notes> {
  return item?.type === RESOURCE_TYPES.notes
}

export function parseWizardEditorResourceSlug(value: string): WizardEditorResourceSlug | null {
  return parseResourceSlug(value)
}

export interface WizardEditorRuntime {
  workspace: {
    id: string
    instanceId: string
  }
  resources: WizardEditorRuntimeResources
  commands: WizardEditorRuntimeCommands
  search: WizardEditorRuntimeSearch
  io: WizardEditorRuntimeIo
  history: WizardEditorHistorySource
  sharing: WizardEditorSharingSource
  navigation: WizardEditorNavigation
  sessions: WizardEditorDocumentSource
}

type WizardEditorNavigationTarget = 'current' | 'separate'

type WizardEditorNavigationOptions = {
  heading?: string
  replace?: boolean
  target?: WizardEditorNavigationTarget
}

export type WizardEditorNavigationResult = MaybePromise<WorkspaceNavigationResult>

export interface WizardEditorNavigation {
  canOpenItemsSeparately: { status: 'available' } | { status: 'unsupported'; reason: string }
  current: WizardEditorNavigationState
  openCreateDashboard: () => WizardEditorNavigationResult
  openDefaultItem: () => WizardEditorNavigationResult
  openItem: (
    resource: WizardEditorResource,
    options?: WizardEditorNavigationOptions,
  ) => WizardEditorNavigationResult
  openExternalUrl: (url: string) => WizardEditorNavigationResult
  openTrash: () => WizardEditorNavigationResult
}

export type WizardEditorNavigationState =
  | {
      kind: 'create'
    }
  | {
      kind: 'empty'
    }
  | {
      kind: 'resource'
      resource: WizardEditorResource | null
    }
  | {
      kind: 'trash'
    }

type WizardEditorNavigationStateResolutionInput = {
  canCreateDashboard: boolean
  isResourceRequested: boolean
  isWorkspaceLoaded: boolean
  resource: WizardEditorResource | null
  trashRequested: boolean
}

export interface WizardEditorCurrentResourceState {
  availabilityState: WizardEditorResourceAvailabilityState
  contentItem: WizardEditorItemWithContent | null
  item: WizardEditorItem | null
}

export interface WizardEditorRuntimeResources {
  catalog: ResourceCatalog
  operationItems: ResourceOperationItems
  paths: FileSystemPaths
  load: FileSystemLoadState
  current: WizardEditorCurrentResourceState
  selection: FileSystemSelection
  permissions: FileSystemPermissions
  resourceContent: ResourceContentSource
}

export interface WizardEditorResourceCatalog {
  getKnownItemById: (itemId: InternalResourceItemId) => WizardEditorItem | null
  getKnownItemBySlug: (slug: ResourceSlug) => WizardEditorItem | null
  getVisibleItemById: (itemId: InternalResourceItemId) => WizardEditorItem | null
  getVisibleItemBySlug: (slug: ResourceSlug) => WizardEditorItem | null
  getVisibleAncestors: (itemId: InternalResourceItemId) => ReadonlyArray<WizardEditorItem>
  getVisibleItems: () => ReadonlyArray<WizardEditorItem>
  getVisibleRoots: () => ReadonlyArray<WizardEditorItem>
  getTrashedItems: () => ReadonlyArray<WizardEditorItem>
  getTrashedRoots: () => ReadonlyArray<WizardEditorItem>
  getVisibleChildren: (parentId: InternalResourceItemId | null) => ReadonlyArray<WizardEditorItem>
  getTrashedChildren: (parentId: InternalResourceItemId | null) => ReadonlyArray<WizardEditorItem>
  queryVisibleItems: (input?: {
    parentId?: InternalResourceItemId | null
    type?: ResourceKind | ReadonlyArray<ResourceKind>
  }) => ReadonlyArray<WizardEditorItem>
}

export interface WizardEditorResourceOperationItems {
  resolveItems: (input: {
    itemIds: ReadonlyArray<InternalResourceItemId>
    excludeItemIds?: ReadonlyArray<InternalResourceItemId>
    includeTrashed?: boolean
  }) => Array<WizardEditorItem>
}

export interface WizardEditorRuntimeCommands {
  operations: FileSystemOperations
}

export interface WizardEditorRuntimeSearch {
  items: FileSystemSearch
}

export interface WizardEditorRuntimeIo {
  download: FileSystemDownload
}

export interface WizardEditorCommandSource {
  capabilities: ResourceCommandCapabilities
  clipboardDriver: ResourceClipboardDriver
  contentInitializers: ResourceImportContentInitializers
  ioCapabilities: ResourceIoCapabilities
  resourceCommandDriver: ResourceCommandDriver
  operationDriver: ResourceOperationDriver
  dropDriver: ResourceDropDriver
  historyDriver: ResourceHistoryOperationDriver
  navigateToItem: (
    slug: ResourceSlug,
    options?: { heading?: string; replace?: boolean },
  ) => Promise<unknown> | void
  onItemSlugChange?: (itemId: ResourceItemId, slug: ResourceSlug | null) => void
  reportCreateItemError: (error: unknown, message: string) => void
  setLastSelectedItem?: (slug: ResourceSlug) => void
  trashDriver: ResourceTrashDriver
}

export interface WizardEditorCommandSourceInput {
  canCreateItems: boolean
  canManageFolders?: boolean
  unavailableReason: string
  clipboardDriver: ResourceClipboardDriver
  contentInitializers: ResourceImportContentInitializers
  ioCapabilities?: ResourceIoCapabilities
  resourceCommandDriver: ResourceCommandDriver
  navigateToItem: WizardEditorCommandSource['navigateToItem']
  onItemSlugChange?: WizardEditorCommandSource['onItemSlugChange']
  reportCreateItemError: WizardEditorCommandSource['reportCreateItemError']
  setLastSelectedItem?: WizardEditorCommandSource['setLastSelectedItem']
  trashDialogDriver: Pick<ResourceTrashDriver, 'confirmDeleteForever' | 'confirmEmptyTrash'>
}

export interface WizardEditorCatalogNavigationInput {
  catalog: ResourceCatalog
  current: WizardEditorNavigationState
  openExternalUrl: WizardEditorNavigation['openExternalUrl']
  openSeparateItem?: (input: { heading?: string; itemId: string }) => void
  separateNavigationUnavailableReason?: string
  setNavigation: (navigation: WizardEditorNavigationState) => void
}

interface WizardEditorRuntimeFilesystemSource {
  catalog: ResourceCatalog
  operationItems: ResourceOperationItems
  paths: FileSystemPaths
  load: FileSystemLoadState
  current: WizardEditorCurrentResourceState
  permissions: FileSystemPermissions
  search: FileSystemSearch
  resourceContent: ResourceContentSource
  download: FileSystemDownload
  history: WizardEditorHistorySource
  sharing: WizardEditorSharingSource
}

type WizardEditorRuntimeResourceSource = Pick<
  WizardEditorRuntimeFilesystemSource,
  'catalog' | 'current' | 'load' | 'operationItems' | 'paths'
> & {
  permissions: WizardEditorPermissionSource
}

type WizardEditorResourceCatalogSource = Pick<
  WizardEditorRuntimeResourceSource,
  'catalog' | 'load' | 'operationItems' | 'paths'
>

export type WizardEditorResourceCatalogSourceInput = {
  activeItems: Array<WizardEditorItem>
  trashItems: Array<WizardEditorItem>
  visibleActiveItems?: Array<WizardEditorItem>
} & FileSystemLoadState

export interface WizardEditorCatalogSnapshot {
  catalog: ResourceCatalog
  current: WizardEditorCurrentResourceState
  operationItems: ResourceOperationItems
  paths: FileSystemPaths
}

export interface WizardEditorCatalogSnapshotInput {
  activeItems: Array<WizardEditorItem>
  trashItems: Array<WizardEditorItem>
  visibleActiveItems?: Array<WizardEditorItem>
  current: WizardEditorNavigationState
  availability?: {
    accessTargetLabel?: string
    actor?: WizardEditorWorkspaceActor | null
    isDirectMessageActor?: boolean
    subject?: WizardEditorResourceAvailabilitySubject
  }
  unavailableResource: {
    label: string
    message: string
  }
}

export interface WizardEditorCatalogPermissionSourceInput extends Omit<
  WizardEditorPermissionSourceInput,
  'getItemById'
> {}

export interface WizardEditorCatalogResourceSourceInput {
  snapshot: WizardEditorCatalogSnapshot
  permissions: WizardEditorPermissionSource | WizardEditorCatalogPermissionSourceInput
}

export interface WizardEditorCatalogDownloadSourceInput {
  file: WizardEditorDocumentFileSourceInput
  resolveCanvasDownloadContent: (canvas: CanvasItemWithContent) => CanvasDocumentContent
  resolveMapDownloadUrl: (map: MapItemWithContent) => string | null
}

export interface WizardEditorSharingSourceInput {
  blocks?: WizardEditorSharingSource['blocks']
  items?: ResourceShareSource
  unavailableReason: UnsupportedSharingSource['reason']
  viewAsParticipant?: {
    canUse: boolean
    isPending: boolean
    participants: Array<EditorShareParticipant>
    selectedParticipantId: EditorShareParticipantId | undefined
    setSelectedParticipantId?: (participantId: EditorShareParticipantId | undefined) => void
  }
}

export interface WizardEditorPermissionSourceInput {
  actor: WizardEditorWorkspaceActor | null
  canCreateItems?: boolean
  canEdit: boolean
  canEmptyTrash?: boolean
  canManageFolders?: boolean
  canUseWorkspaceActions: boolean
  getItemById: (itemId: ResourceItemId) => WizardEditorItem | null | undefined
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  workspaceMode: WorkspaceMode
}

export interface WizardEditorPermissionSource {
  actor: WizardEditorWorkspaceActor | null
  canCreateItems: boolean
  canEdit: boolean
  canEmptyTrash: boolean
  canManageFolders: boolean
  canAccessItem: (item: WizardEditorItem, requiredLevel: PermissionLevel) => boolean
  canMutateItem: (item: WizardEditorItem, requiredLevel: PermissionLevel) => boolean
  getMemberItemPermissionLevel: (
    item: WizardEditorItem,
    participantId: EditorShareParticipantId,
  ) => PermissionLevel
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  workspaceMode: WorkspaceMode
}

export interface WizardEditorWorkspaceModeInput {
  actor: WizardEditorWorkspaceActor | null
  currentItem: WizardEditorItem | null
  getItemById: (itemId: ResourceItemId) => WizardEditorItem | null | undefined
  rawWorkspaceMode: WorkspaceMode
}

export interface WizardEditorResourceAvailabilityMetadataSourceInput {
  catalog: Pick<
    ResourceCatalog,
    'getKnownItemById' | 'getKnownItemBySlug' | 'getVisibleItemById' | 'getVisibleItemBySlug'
  >
  load: Pick<FileSystemLoadState, 'activeStatus'>
}

export interface WizardEditorResourceAvailabilityStateInput {
  lookup: WizardEditorResourceAvailabilityLookup
  metadataSource: WizardEditorResourceAvailabilityMetadataSource
  readableItem: WizardEditorItemWithContent | null | undefined
  readableItemLoading?: boolean
  readableItemError?: unknown
  actor: WizardEditorWorkspaceActor | null
  accessTargetLabel: string
  isDirectMessageActor: boolean
  subject: WizardEditorResourceAvailabilitySubject
  fallbackLabel: string
}

export interface WizardEditorHydratedCatalogSearchSourceInput<SourceId extends string = string> {
  catalog: ResourceCatalog
  itemLinks: Extract<FileSystemSearch, { status: 'available' }>['itemLinks']
  recentItems?: Array<ItemSearchResult>
  revision: string | number
  searchBody: (input: { query: string }) => Promise<Array<BlockSearchResult> | undefined>
  sourceId: SourceId | null | undefined
}

export interface WizardEditorHydratedCatalogResourceContentSourceInput<
  SourceId extends string = string,
> {
  catalog: ResourceCatalog
  current: WizardEditorCurrentResourceState
  loadItemContent: (itemId: InternalResourceItemId) => Promise<WizardEditorItemWithContent | null>
  contentProjection?: {
    canAccessItem: (item: WizardEditorItem, requiredLevel: PermissionLevel) => boolean
    getMemberItemPermissionLevel: (
      item: WizardEditorItem,
      participantId: EditorShareParticipantId,
    ) => PermissionLevel
    viewAsParticipantId: EditorShareParticipantId | undefined
  }
  sourceId: SourceId | null | undefined
}

export interface WizardEditorFileContentSourceInput {
  canReplaceFile: (file: FileItem) => boolean
  getItemById: (itemId: ResourceItemId) => WizardEditorItem | null
  maxUploadBytes?: number
  readOnlyErrorMessage?: string
  resolveFile: (file: FileItemWithContent) => WizardEditorResolvedFile
  writeFile: (input: {
    file: ResourceImportFile
    fileId: ResourceItemId
    onProgress?: (percentage: number) => void
  }) => MaybePromise<void>
}

export interface WizardEditorFileContentSource {
  initializeImportedFile: ResourceImportContentInitializers['initializeImportedFile']
  resolveFileDownloadUrl: (file: FileItemWithContent) => string | null
  session: WizardEditorFileSession
}

interface WizardEditorResolvedFileBase {
  contentType: string | null
  name: string
  size: number | null
}

export type WizardEditorResolvedFile =
  | (WizardEditorResolvedFileBase & {
      allowDataUrl?: boolean
      allowObjectUrl: boolean
      downloadUrl: string
      status: 'available'
    })
  | (WizardEditorResolvedFileBase & {
      allowObjectUrl: false
      downloadUrl: null
      status: 'unattached'
    })
  | (WizardEditorResolvedFileBase & {
      allowObjectUrl: false
      downloadUrl: null
      reason: 'missing'
      status: 'unavailable'
    })

export interface WizardEditorFileSessionReplaceInput<TFileId extends string = string> {
  fileId: TFileId
  file: ResourceImportFile
}

export interface WizardEditorFileSession<TFileId extends string = string> {
  maxUploadBytes?: number
  replaceFile(
    input: WizardEditorFileSessionReplaceInput<TFileId>,
  ): MaybePromise<ResourceOperationResult>
  resolveFile: (file: FileItemWithContent) => WizardEditorResolvedFile
}

export type WizardEditorPdfPreviewGenerationResult =
  | { status: 'unsupported' }
  | { status: 'skipped-too-large'; size: number; maxSize: number }
  | { status: 'published' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown }

export type WizardEditorPreviewUploadResult =
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'error'; error: unknown }

export type WizardEditorPreviewUpload<TItemId extends string = string> = (
  itemId: TItemId,
  generate: () => Promise<Blob>,
  options?: { signal?: AbortSignal },
) => Promise<WizardEditorPreviewUploadResult>

type WizardEditorPreviewUploadCapability<TItemId extends string = string> =
  | {
      status: 'available'
      upload: WizardEditorPreviewUpload<TItemId>
    }
  | {
      status: 'unsupported'
    }

export type WizardEditorMapImageReplacementStageResult<TImage, TMapId extends string = string> =
  | {
      status: 'staged'
      image: TImage
      cancel: (input: {
        image: TImage
        layerId: string | null
        mapId: TMapId
      }) => MaybePromise<ResourceOperationResult>
    }
  | Exclude<ResourceOperationResult, { status: 'completed' }>

export interface WizardEditorMapImageReplacementInput<TImage, TMapId extends string = string> {
  file: ResourceImportFile
  layerId?: string | null
  mapId: TMapId
  stageImage: (input: {
    file: ResourceImportFile
    layerId: string | null
    mapId: TMapId
  }) => MaybePromise<WizardEditorMapImageReplacementStageResult<TImage, TMapId>>
  commitImage: (input: {
    image: TImage
    layerId: string | null
    mapId: TMapId
  }) => MaybePromise<ResourceOperationResult>
}
export interface WizardEditorMapImageLayer {
  id: string
  imageAssetId: string | null
  imageUrl: string | null
  name: string
}
export interface WizardEditorMapImageSource {
  imageAssetId: string | null
  imageUrl: string | null
  layers?: ReadonlyArray<WizardEditorMapImageLayer>
}
export interface WizardEditorResolvedMapImage {
  imageAssetId: string | null
  imageUrl: string | null
  layer: WizardEditorMapImageLayer | null
}

type WizardEditorAvailableDownload = Extract<FileSystemDownload, { status: 'available' }>
export interface WizardEditorDownloadRequest {
  itemIds: ReadonlyArray<ResourceItemId>
  items?: ReadonlyArray<WizardEditorItem>
}
export type WizardEditorRemoteDownloadResult =
  | {
      items: Array<FileSystemDownloadItem>
    }
  | FileSystemDownloadResult
type WizardEditorDownloadSource =
  | FileSystemDownload
  | {
      kind: 'remoteItems'
      loadItemsForDownload: (
        input: WizardEditorDownloadRequest,
      ) => Promise<WizardEditorRemoteDownloadResult>
      loadRootItemsForDownload: () => Promise<WizardEditorRemoteDownloadResult>
    }
export type WizardEditorRemoteDownloadSource = Extract<
  WizardEditorDownloadSource,
  { kind: 'remoteItems' }
>

export interface WizardEditorRemoteDownloadSourceInput {
  canDownloadRoot: boolean
  loadItemsForDownload: WizardEditorRemoteDownloadSource['loadItemsForDownload']
  loadRootItemsForDownload: WizardEditorRemoteDownloadSource['loadRootItemsForDownload']
  unavailableRootReason: string
}

export interface WizardEditorIoSource {
  download: WizardEditorDownloadSource
}

export interface WizardEditorSearchSource {
  items: FileSystemSearch
}

export interface WizardEditorRuntimeResourceSourceInput {
  catalog: ResourceCatalog
  current: WizardEditorCurrentResourceState
  load: FileSystemLoadState
  operationItems: ResourceOperationItems
  paths: FileSystemPaths
  permissions: WizardEditorPermissionSource
  resourceContent: ResourceContentSource
}

export interface WizardEditorHistoryMemberSummary {
  id: string
  name: string | null
  username: string | null
  imageUrl: string | null
}

type WizardEditorHistoryPreviewImageUrlState =
  | { status: 'idle' }
  | { status: 'error' }
  | { status: 'ready'; url: string }

type WizardEditorHistoryPreviewSnapshot =
  | { kind: 'note-yjs'; noteId: InternalResourceItemId; data: ArrayBuffer }
  | { kind: 'canvas-yjs'; canvasId: InternalResourceItemId; data: ArrayBuffer }
  | {
      kind: 'game-map'
      snapshotData: GameMapSnapshotData
      imageUrlState: WizardEditorHistoryPreviewImageUrlState
    }
  | { kind: 'unsupported' }

type WizardEditorHistoryPreviewState =
  | { status: 'loading'; entryTime: number | undefined }
  | { status: 'error'; entryTime: number | undefined }
  | { status: 'unavailable'; entryTime: number | undefined }
  | {
      status: 'ready'
      entryTime: number | undefined
      snapshot: WizardEditorHistoryPreviewSnapshot
    }

type WizardEditorRollbackState =
  | { status: 'closed'; isRestoring: false }
  | { status: 'loading'; isRestoring: boolean }
  | { status: 'error'; isRestoring: boolean }
  | { status: 'ready'; entryTime: number; isRestoring: boolean }

type WizardEditorHistoryEntriesLoadStatus =
  | 'LoadingFirstPage'
  | 'CanLoadMore'
  | 'LoadingMore'
  | 'Exhausted'

interface WizardEditorHistoryEntriesState {
  canEdit: boolean
  entries: Array<EditHistoryEntry>
  membersMap: ReadonlyMap<string, WizardEditorHistoryMemberSummary>
  myMemberId: string | null
  previewingEntryId: EditHistoryId | null
  status: WizardEditorHistoryEntriesLoadStatus
}

interface WizardEditorHistoryEntriesModel {
  loadMore: () => void
  state: WizardEditorHistoryEntriesState
}

interface WizardEditorAvailableHistorySource {
  status: 'available'
  itemId: InternalResourceItemId
  entries: WizardEditorHistoryEntriesModel
  previewingEntryId: EditHistoryId | null
  preview: WizardEditorHistoryPreviewState
  previewEntry: (entryId: EditHistoryId | null) => void
  rollbackEntryId: EditHistoryId | null
  rollback: WizardEditorRollbackState
  requestRollback: (entryId: EditHistoryId | null) => void
  restoreRollback: (entryId: EditHistoryId) => MaybePromise<HistoryRollbackResult>
  clearPreview: () => void
  clearRollback: () => void
  clearItemSession: () => void
}

export type WizardEditorHistorySource =
  | WizardEditorAvailableHistorySource
  | {
      status: 'unsupported'
      reason: 'not_implemented'
    }

export interface WizardEditorHistoryScopeInput {
  canEdit: boolean
  itemId: InternalResourceItemId | null
  previewingEntryId: EditHistoryId | null
  rollbackEntryId: EditHistoryId | null
}

export interface WizardEditorHistoryScope {
  activePreviewingEntryId: EditHistoryId | null
  activeRollbackEntryId: EditHistoryId | null
  persistedItemId: InternalResourceItemId | null
}

export interface WizardEditorHistoryEntriesInput {
  canEdit: boolean
  entries: Array<EditHistoryEntry>
  loadMore: () => void
  members: Iterable<WizardEditorHistoryMemberSummary>
  myMemberId: string | null
  previewingEntryId: EditHistoryId | null
  status: WizardEditorHistoryEntriesLoadStatus
}

export interface WizardEditorHistoryPreviewInput {
  entryTime: number | undefined
  historyEntryError: unknown
  historyEntryLoading: boolean
  snapshot: WizardEditorHistoryPreviewSnapshot | null | undefined
  snapshotError: unknown
  snapshotLoading: boolean
}

export interface WizardEditorHistoryRollbackInput {
  entryTime: number | undefined
  historyEntryError: unknown
  historyEntryLoading: boolean
  isRestoring: boolean
}

export interface WizardEditorHistoryInput {
  activeRollbackEntryId: EditHistoryId | null
  clearItemSession: () => void
  clearPreview: () => void
  clearRollback: () => void
  entries: WizardEditorHistoryEntriesInput
  itemId: InternalResourceItemId | null
  previewEntry: (entryId: EditHistoryId | null) => void
  preview: WizardEditorHistoryPreviewInput
  requestRollback: (entryId: EditHistoryId | null) => void
  restoreRollback: (
    entryId: EditHistoryId,
  ) => HistoryRollbackResult | Promise<HistoryRollbackResult>
  rollback: WizardEditorHistoryRollbackInput
}

export interface WizardEditorCatalogItemLinkRow {
  id: string
  query: string
  displayName: string | null
  item: { id: ResourceItemId; name: string } | null
}

export interface WizardEditorResourceSource extends WizardEditorRuntimeResourceSourceInput {}

interface WizardEditorMapSessionUpdateImageInput {
  file: ResourceImportFile
  layerId?: string | null
  mapId: InternalResourceItemId
}

export type WizardEditorMapPinCreationRequest = {
  itemId: InternalResourceItemId
  layerId?: string | null
  x: number
  y: number
}

interface WizardEditorMapSessionCreatePinsInput {
  mapId: InternalResourceItemId
  pins: Array<WizardEditorMapPinCreationRequest>
}

interface WizardEditorMapSessionUpdatePinInput {
  mapId: InternalResourceItemId
  mapPinId: InternalMapPinId
  x: number
  y: number
}

interface WizardEditorMapSessionSetPinVisibilityInput {
  mapId: InternalResourceItemId
  mapPinId: InternalMapPinId
  isVisible: boolean
}

interface WizardEditorMapSessionRemovePinInput {
  mapId: InternalResourceItemId
  mapPinId: InternalMapPinId
}

type WizardEditorMapPinsCreatedReceipt = {
  kind: 'mapPinsCreated'
  affectedCount: number
  itemId: InternalResourceItemId
  pinIds: Array<InternalMapPinId>
}

type WizardEditorMapPinsCreateResult =
  | { status: 'completed'; receipt: WizardEditorMapPinsCreatedReceipt }
  | Exclude<ResourceOperationResult, { status: 'completed' }>

type WizardEditorMapPinOperationKind = 'mapPinUpdated' | 'mapPinVisibilityUpdated' | 'mapPinRemoved'

interface WizardEditorMapPinOperationInput {
  kind: WizardEditorMapPinOperationKind
  mapId: InternalResourceItemId
}

export interface WizardEditorMapPinCreationsInput<TPin> {
  mapId: InternalResourceItemId
  existingPinnedItemIds: Iterable<InternalResourceItemId>
  pins: ReadonlyArray<WizardEditorMapPinCreationRequest>
  canPinItem: (itemId: InternalResourceItemId) => boolean
  createPin: (pin: WizardEditorMapPinCreationRequest) => TPin
}

interface WizardEditorMapPinSession {
  create: (
    input: WizardEditorMapSessionCreatePinsInput,
  ) => MaybePromise<WizardEditorMapPinsCreateResult>
  update: (input: WizardEditorMapSessionUpdatePinInput) => MaybePromise<ResourceOperationResult>
  setVisibility: (
    input: WizardEditorMapSessionSetPinVisibilityInput,
  ) => MaybePromise<ResourceOperationResult>
  remove: (input: WizardEditorMapSessionRemovePinInput) => MaybePromise<ResourceOperationResult>
}

export interface WizardEditorMapSession {
  pins: WizardEditorMapPinSession
  updateMapImage: (
    input: WizardEditorMapSessionUpdateImageInput,
  ) => MaybePromise<ResourceOperationResult>
}

export interface WizardEditorNoteCollaborationPlayback {
  collaborators: ReadonlyArray<{ color: string; name: string }>
  initialTypingStep: number
  intervalMs?: number
  noteId: InternalResourceItemId
  typingBlockIndex: number
  typingText: string
}

export type WizardEditorNoteCollaborationSessionMode = 'editable' | 'readonly'

export interface WizardEditorNoteCollaborationSessionRequest {
  mode: WizardEditorNoteCollaborationSessionMode
  note: ResourceWithContentByKind<typeof RESOURCE_TYPES.notes>
}

export interface WizardEditorNoteCollaborationEngine {
  doc: Doc
  provider: YjsCollaborationProvider
}

interface WizardEditorNoteEditorSessionBase {
  instanceId: string | number
  mode: WizardEditorNoteCollaborationSessionMode
  user: {
    color: string
    name: string
  }
}

export type WizardEditorNoteEditorSession =
  | (WizardEditorNoteEditorSessionBase & { status: 'loading' })
  | (WizardEditorNoteEditorSessionBase & { status: 'error'; error: Error })
  | (WizardEditorNoteEditorSessionBase & {
      status: 'unavailable'
      reason: 'missing_collaboration_engine' | 'optimistic_resource_pending'
    })
  | (WizardEditorNoteEditorSessionBase & {
      status: 'ready'
      engine: WizardEditorNoteCollaborationEngine
      updateUser?: (user: { color: string; name: string }) => void
    })

type WizardEditorNoteValueStatesForNotesStatus = 'pending' | 'success' | 'error'

interface WizardEditorNoteValueStatesLoad {
  states: Array<NoteValueRuntimeState<InternalResourceItemId>>
  status: WizardEditorNoteValueStatesForNotesStatus
}

interface WizardEditorNoteHeadingsLoad {
  headings: Array<Heading>
  status: WizardEditorNoteValueStatesForNotesStatus
}

interface WizardEditorNoteDocumentSessionSource {
  useCollaborationSession: (
    request: WizardEditorNoteCollaborationSessionRequest,
  ) => WizardEditorNoteEditorSession
}

interface WizardEditorNotePlaybackSource {
  getCollaborationPlayback?: (
    noteId: InternalResourceItemId,
  ) => WizardEditorNoteCollaborationPlayback | undefined
}

interface WizardEditorNoteHeadingSource {
  useNoteHeadings: (noteId: InternalResourceItemId | null) => WizardEditorNoteHeadingsLoad
}

interface WizardEditorNoteValueRuntimeStateSource {
  useNoteValueStates: (noteIds: Array<InternalResourceItemId>) => WizardEditorNoteValueStatesLoad
}

export interface WizardEditorNoteSessionPorts {
  document: WizardEditorNoteDocumentSessionSource
}

export interface WizardEditorNoteHeadingSessionPorts {
  headings: WizardEditorNoteHeadingSource
}

export interface WizardEditorNotePlaybackSessionPorts {
  playback: WizardEditorNotePlaybackSource
}

export interface WizardEditorNoteValueSessionPorts {
  values: WizardEditorNoteValueRuntimeStateSource
}

export interface WizardEditorCanvasCollaborationProvider {
  awareness: Awareness
  flushUpdates: () => Promise<void> | void
}

type WizardEditorCanvasCollaborationCapability =
  | { status: 'available'; provider: WizardEditorCanvasCollaborationProvider }
  | { status: 'unsupported' }
  | { status: 'unavailable' }

export type WizardEditorCanvasDocumentSession =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready'
      canvasId: InternalResourceItemId
      workspaceId: string
      canEdit: boolean
      colorMode: 'light' | 'dark'
      parentId: InternalResourceItemId | null
      collaboration: WizardEditorCanvasCollaborationCapability
      user: { name: string; color: string }
      doc: Doc
      nodesMap: YMap<CanvasDocumentNode>
      edgesMap: YMap<CanvasDocumentEdge>
    }

export type WizardEditorCanvasDocumentCollaborationSession =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready'
      doc: Doc
      collaboration: WizardEditorCanvasCollaborationCapability
    }

export function createWizardEditorCanvasDocumentDoc(content: CanvasDocumentContent): Doc {
  return createCanvasDocumentDoc(content)
}

export function readWizardEditorCanvasDocumentContent(doc: Doc): {
  edges: Array<CanvasDocumentEdge>
  nodes: Array<CanvasDocumentNode>
} {
  return readCanvasDocumentContent(doc)
}

export function useWizardEditorCanvasDocumentSession({
  canvas,
  canEdit,
  collaboration,
  colorMode,
  user,
}: {
  canvas: CanvasItemWithContent
  canEdit: boolean
  collaboration: WizardEditorCanvasDocumentCollaborationSession
  colorMode: 'light' | 'dark'
  user: { name: string; color: string }
}): WizardEditorCanvasDocumentSession {
  return useCanvasDocumentSession({ canvas, canEdit, collaboration, colorMode, user })
}

export interface WizardEditorEmbeddedCanvasUpdate {
  revision: number
  seq: number
  update: ArrayBuffer | Uint8Array
}

export interface WizardEditorEmbeddedCanvasUpdateState {
  data: ReadonlyArray<WizardEditorEmbeddedCanvasUpdate> | undefined
  isError: boolean
}

export type WizardEditorEmbeddedCanvasUpdateSource = (input: {
  afterSeq: number | undefined
  canvasId: InternalResourceItemId
}) => WizardEditorEmbeddedCanvasUpdateState

export type WizardEditorEmbeddedCanvasState =
  | {
      status: 'available'
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
    }
  | { status: 'loading' }
  | { status: 'unavailable' }

export function useWizardEditorEmbeddedCanvasStateFromUpdates({
  canvasId,
  useUpdates,
}: {
  canvasId: InternalResourceItemId
  useUpdates: WizardEditorEmbeddedCanvasUpdateSource
}): WizardEditorEmbeddedCanvasState {
  return useEmbeddedCanvasStateFromUpdates({ canvasId, useUpdates })
}

interface WizardEditorCanvasDocumentSessionCapability {
  useCanvasDocumentSession: (input: {
    canEdit: boolean
    canvas: CanvasItemWithContent
  }) => WizardEditorCanvasDocumentSession
}

interface WizardEditorCanvasDocumentSessionSource {
  useCanvasDocumentSession: (canvas: CanvasItemWithContent) => WizardEditorCanvasDocumentSession
}

interface WizardEditorCanvasEmbeddedCanvasSource {
  useEmbeddedCanvasState: (canvasId: InternalResourceItemId) => WizardEditorEmbeddedCanvasState
}

interface WizardEditorCanvasEmbeddedCanvasCapability {
  useEmbeddedCanvasState: (canvasId: InternalResourceItemId) => WizardEditorEmbeddedCanvasState
}

interface WizardEditorCanvasSessionAccessCapability {
  canEditCanvas: (canvas: CanvasItemWithContent) => boolean
}

export interface WizardEditorCanvasSessionPorts {
  document: WizardEditorCanvasDocumentSessionSource
}

export interface WizardEditorCanvasEmbeddedSessionPorts {
  embeddedCanvas: WizardEditorCanvasEmbeddedCanvasSource
}

export interface WizardEditorCanvasSessionPortsInput {
  access: WizardEditorCanvasSessionAccessCapability
  documentSession: WizardEditorCanvasDocumentSessionCapability
}

export interface WizardEditorCanvasEmbeddedSessionPortsInput {
  embeddedCanvas: WizardEditorCanvasEmbeddedCanvasCapability
}

export function createWizardEditorCanvasSessionPorts(
  input: WizardEditorCanvasSessionPortsInput,
): WizardEditorCanvasSessionPorts {
  const internalPorts = createCanvasSessionPorts({
    access: input.access,
    documentSession: input.documentSession,
  })

  return {
    document: {
      useCanvasDocumentSession: (canvas) => internalPorts.document.useCanvasDocumentSession(canvas),
    },
  }
}

export function createWizardEditorCanvasEmbeddedSessionPorts(
  input: WizardEditorCanvasEmbeddedSessionPortsInput,
): WizardEditorCanvasEmbeddedSessionPorts {
  return createCanvasEmbeddedSessionPorts(input)
}

export interface WizardEditorDocumentSource {
  canvas: WizardEditorCanvasSessionPorts
  canvasEmbedded: WizardEditorCanvasEmbeddedSessionPorts
  canvasPreviewUpload: WizardEditorPreviewUploadCapability<InternalResourceItemId>
  file: WizardEditorFileSession
  map: WizardEditorMapSession
  note: WizardEditorNoteSessionPorts
  noteHeadings: WizardEditorNoteHeadingSessionPorts
  notePlayback: WizardEditorNotePlaybackSessionPorts
  noteValues: WizardEditorNoteValueSessionPorts
}

export interface WizardEditorDocumentSourceInput extends WizardEditorDocumentSource {}

export type WizardEditorDocumentFileSourceInput =
  | WizardEditorFileSession
  | WizardEditorFileContentSourceInput

export interface WizardEditorRuntimeDocumentSourceInput extends Omit<
  WizardEditorDocumentSource,
  'file'
> {
  file: WizardEditorDocumentFileSourceInput
}

export interface WizardEditorAdapter {
  commands: WizardEditorCommandSource
  documents: WizardEditorDocumentSource
  history: WizardEditorHistorySource
  io: WizardEditorIoSource
  navigation: WizardEditorNavigation
  resources: WizardEditorResourceSource
  search: WizardEditorSearchSource
  sharing: WizardEditorSharingSource
  workspace: WizardEditorWorkspaceSource
}

type WizardEditorRuntimeContentInitializerInput = Pick<
  ResourceImportContentInitializers,
  'initializeImportedTextFile'
> &
  Partial<Pick<ResourceImportContentInitializers, 'initializeImportedFile'>>

export interface WizardEditorRuntimeSourcesInput {
  commands: Omit<WizardEditorCommandSourceInput, 'contentInitializers'> & {
    contentInitializers: WizardEditorRuntimeContentInitializerInput
  }
  documents: WizardEditorRuntimeDocumentSourceInput
  history: WizardEditorHistorySource
  io: WizardEditorIoSource
  resources: WizardEditorResourceSource
  search: WizardEditorSearchSource
  sharing: WizardEditorSharingSource | WizardEditorSharingSourceInput
}

export function createWizardEditorRuntime(adapter: WizardEditorAdapter): WizardEditorRuntime {
  const operations = createWorkspaceFileSystemOperations({
    ...adapter.commands,
    catalog: adapter.resources.catalog,
    currentItem: adapter.resources.current.item,
  })

  const workspaceRuntime = createWorkspaceRuntime({
    filesystem: {
      ...adapter.resources,
      operations,
      search: adapter.search.items,
      download: resolveWizardEditorDownloadSource(adapter.io.download),
      history: adapter.history,
      sharing: adapter.sharing,
    },
    navigation: adapter.navigation,
    sessions: toInternalWizardEditorDocumentSource(adapter.documents),
    workspaceInstanceId: adapter.workspace.instanceId,
    workspaceId: adapter.workspace.id,
  })

  return {
    workspace: workspaceRuntime.workspace,
    resources: {
      catalog: workspaceRuntime.filesystem.catalog,
      operationItems: workspaceRuntime.filesystem.operationItems,
      paths: workspaceRuntime.filesystem.paths,
      load: workspaceRuntime.filesystem.load,
      current: workspaceRuntime.filesystem.current,
      selection: workspaceRuntime.filesystem.selection,
      permissions: workspaceRuntime.filesystem.permissions,
      resourceContent: workspaceRuntime.filesystem.resourceContent,
    },
    commands: {
      operations: workspaceRuntime.filesystem.operations,
    },
    search: {
      items: workspaceRuntime.filesystem.search,
    },
    io: {
      download: workspaceRuntime.filesystem.download,
    },
    history: workspaceRuntime.filesystem.history,
    sharing: workspaceRuntime.filesystem.sharing,
    navigation: workspaceRuntime.navigation as WizardEditorNavigation,
    sessions: toWizardEditorDocumentSource(workspaceRuntime.sessions),
  }
}

export function createWizardEditorRuntimeSources({
  commands,
  documents,
  history,
  io,
  resources,
  search,
  sharing,
}: WizardEditorRuntimeSourcesInput): Pick<
  WizardEditorAdapter,
  'commands' | 'documents' | 'history' | 'io' | 'resources' | 'search' | 'sharing'
> {
  const fileContent = resolveWizardEditorFileDocumentSource(documents.file)
  const contentInitializers: ResourceImportContentInitializers = {
    initializeImportedFile:
      commands.contentInitializers.initializeImportedFile ?? fileContent.initializeImportedFile,
    initializeImportedTextFile: commands.contentInitializers.initializeImportedTextFile,
  }

  return {
    commands: createWizardEditorCommandSource({
      ...commands,
      contentInitializers,
    }),
    documents: createWizardEditorDocumentSource({
      canvas: documents.canvas,
      canvasEmbedded: documents.canvasEmbedded,
      canvasPreviewUpload: documents.canvasPreviewUpload,
      file: fileContent.session,
      map: documents.map,
      note: documents.note,
      noteHeadings: documents.noteHeadings,
      notePlayback: documents.notePlayback,
      noteValues: documents.noteValues,
    }),
    history,
    io,
    resources,
    search,
    sharing: isWizardEditorSharingSourceInput(sharing)
      ? createWizardEditorSharingSource(sharing)
      : sharing,
  }
}

export function createWizardEditorDocumentSource(
  input: WizardEditorDocumentSourceInput,
): WizardEditorDocumentSource {
  return input
}

export function useWizardEditorResourceCommandRuntime(
  input: ResourceCommandRuntimeArgs,
): ResourceCommandRuntime {
  return useWorkspaceResourceCommandRuntime(input)
}

export function isWizardEditorResourceCatalogCommand(
  command: WizardEditorResourceCommand,
): command is WizardEditorResourceCatalogCommand {
  return isResourceCatalogCommand(command)
}

export function isWizardEditorResourceSharingCommand(
  command: WizardEditorResourceCommand,
): command is WizardEditorResourceSharingCommand {
  return isResourceSharingCommand(command)
}

export function completeWizardEditorResourceCommand(
  command: WizardEditorResourceCommand,
  events: Array<WizardEditorResourceEvent>,
  { transactionId = null, undoable = false }: WizardEditorResourceCommandCompletionOptions = {},
): WizardEditorResourceCommandResult<never> {
  return completedResourceCommand(command, events, {
    transactionId: transactionId as ResourceTransactionReceipt['transactionId'],
    undoable,
  })
}

export interface WizardEditorYjsCollaborationSessionInput {
  canEdit: boolean
  documentId: ResourceItemId
  onBeforeDestroy?: (state: YjsSessionBeforeDestroyInput) => Promise<void> | void
  sourceId: string | null | undefined
  transport: YjsSessionTransport
  user: YjsProviderUser
  useAwareness: YjsCollaborationSourceHook<YjsCollaborationAwarenessEntry>
  useUpdates: YjsCollaborationSourceHook<YjsCollaborationUpdateEntry>
}

export function useWizardEditorYjsCollaborationSession(
  input: WizardEditorYjsCollaborationSessionInput,
): YjsCollaborationSession {
  return useYjsCollaborationSession({
    ...input,
    documentId: input.documentId as InternalResourceItemId,
  })
}

export type WizardEditorNoteYjsPersistenceSession<Provider> = {
  doc: Doc | null
  provider: Provider | null
  isLoading: boolean
}

export type WizardEditorNoteYjsBeforeDestroyState<Provider> = {
  noteId: ResourceItemId
  sourceId: string
  provider: Provider
}

export type WizardEditorNoteYjsPersistenceAdapter<Provider> = {
  flushProvider: (provider: Provider, label: string) => Promise<boolean> | boolean
  isApplyingRemoteUpdate: (provider: Provider) => boolean
  persistNote: (
    noteId: ResourceItemId,
    sourceId: string,
  ) => Promise<NoteProjectionResult> | NoteProjectionResult
  reportError: (message: string, error?: unknown) => void
}

export function useWizardEditorNoteYjsPersistenceLifecycle<Provider>(input: {
  noteId: ResourceItemId
  sourceId: string | null | undefined
  canEdit: boolean
  session: WizardEditorNoteYjsPersistenceSession<Provider>
  adapter: WizardEditorNoteYjsPersistenceAdapter<Provider>
}) {
  const persistence = useNoteYjsPersistenceLifecycle({
    ...input,
    noteId: input.noteId as InternalResourceItemId,
  })

  return {
    handleBeforeDestroy: (state: WizardEditorNoteYjsBeforeDestroyState<Provider>) =>
      persistence.handleBeforeDestroy({
        ...state,
        noteId: state.noteId as InternalResourceItemId,
      }),
  }
}

export function flushWizardEditorYjsProviderPendingUpdates(provider: YjsCollaborationProvider) {
  return provider.flushPendingUpdates()
}

export function isWizardEditorYjsProviderApplyingRemoteUpdate(provider: YjsCollaborationProvider) {
  return provider.isApplyingRemoteUpdate()
}

export function updateWizardEditorYjsProviderUser(
  provider: YjsCollaborationProvider,
  user: YjsProviderUser,
) {
  return provider.updateUser(user)
}

export function createWizardEditorCatalogItemLink(row: WizardEditorCatalogItemLinkRow) {
  const internalRow = (
    row.item ? { ...row, item: { ...row.item, id: row.item.id as InternalResourceItemId } } : row
  ) as InternalCatalogItemLinkRow
  return createCatalogItemLink(internalRow)
}

export function createWizardEditorCatalogItemSearchResult(
  catalog: ResourceCatalog,
  item: WizardEditorItem,
) {
  return createCatalogItemSearchResult(catalog, item)
}

export function createWizardEditorCommandSource({
  canCreateItems,
  canManageFolders = canCreateItems,
  clipboardDriver,
  contentInitializers,
  ioCapabilities = {},
  resourceCommandDriver,
  navigateToItem,
  onItemSlugChange,
  reportCreateItemError,
  setLastSelectedItem,
  trashDialogDriver,
  unavailableReason,
}: WizardEditorCommandSourceInput): WizardEditorCommandSource {
  const { dropDriver, historyDriver, operationDriver, trashDriver } = createResourceCommandDrivers(
    resourceCommandDriver,
    trashDialogDriver,
  )

  return {
    capabilities: {
      createItems: createWizardEditorCommandCapability(canCreateItems, unavailableReason),
      manageFolders: createWizardEditorCommandCapability(canManageFolders, unavailableReason),
    },
    clipboardDriver,
    contentInitializers,
    dropDriver,
    historyDriver,
    ioCapabilities,
    resourceCommandDriver,
    navigateToItem,
    onItemSlugChange,
    operationDriver,
    reportCreateItemError,
    setLastSelectedItem,
    trashDriver,
  }
}

export function createWizardEditorCatalogNavigation({
  catalog,
  current,
  openExternalUrl,
  openSeparateItem,
  separateNavigationUnavailableReason = 'separate_navigation_unsupported',
  setNavigation,
}: WizardEditorCatalogNavigationInput): WizardEditorNavigation {
  const isOpenableItem = (itemId: ResourceId) => {
    if (catalog.getVisibleItemById(itemId as InternalResourceItemId)) return true
    return (
      current.kind === 'trash' &&
      catalog.getKnownItemById(itemId as InternalResourceItemId)?.isTrashed === true
    )
  }
  const openItemInCurrentSurface = (itemId: ResourceId) => {
    setNavigation({ kind: 'resource', resource: createWizardEditorResource(itemId) })
    return completedWizardEditorNavigation()
  }

  return {
    canOpenItemsSeparately: openSeparateItem
      ? { status: 'available' }
      : { status: 'unsupported', reason: separateNavigationUnavailableReason },
    current,
    openCreateDashboard: () => {
      setNavigation({ kind: 'create' })
      return completedWizardEditorNavigation()
    },
    openDefaultItem: () => {
      const currentItemId = getWizardEditorNavigationCurrentResourceId({ current })
      const itemId =
        currentItemId && catalog.getVisibleItemById(currentItemId)
          ? currentItemId
          : catalog.getVisibleRoots()[0]?.id
      return itemId
        ? openItemInCurrentSurface(itemId)
        : unavailableWizardEditorNavigation('default_resource_unavailable')
    },
    openItem: (resource, options) => {
      const itemId = getWizardEditorResourceId(resource)
      if (options?.target === 'separate') {
        if (!openSeparateItem) {
          return unavailableWizardEditorNavigation(separateNavigationUnavailableReason)
        }
        if (!isOpenableItem(itemId)) {
          return unavailableWizardEditorNavigation('resource_not_visible')
        }
        openSeparateItem({ heading: options.heading, itemId: String(itemId) })
        return completedWizardEditorNavigation()
      }
      if (!isOpenableItem(itemId)) {
        return unavailableWizardEditorNavigation('resource_not_visible')
      }
      return openItemInCurrentSurface(itemId)
    },
    openExternalUrl,
    openTrash: () => {
      setNavigation({ kind: 'trash' })
      return completedWizardEditorNavigation()
    },
  }
}

function completedWizardEditorNavigation(): WorkspaceNavigationResult {
  return { status: 'completed' }
}

function unavailableWizardEditorNavigation(reason: string): WorkspaceNavigationResult {
  return { status: 'unavailable', reason }
}

export function createWizardEditorResourceCatalogSource({
  activeItems,
  visibleActiveItems,
  trashItems,
  activeError,
  activeStatus,
  refreshActive,
  refreshTrash,
  trashError,
  trashStatus,
}: WizardEditorResourceCatalogSourceInput): WizardEditorResourceCatalogSource {
  const catalogModel = createResourceCatalogModel({
    activeItems,
    trashItems,
    visibleActiveItems,
  })

  return {
    ...catalogModel,
    load: {
      activeError,
      activeStatus,
      refreshActive,
      refreshTrash,
      trashError,
      trashStatus,
    },
  }
}

export function createWizardEditorCatalogSnapshot({
  activeItems,
  availability,
  current,
  trashItems,
  unavailableResource,
  visibleActiveItems,
}: WizardEditorCatalogSnapshotInput): WizardEditorCatalogSnapshot {
  const { catalog, operationItems, paths } = createResourceCatalogModel({
    activeItems,
    trashItems,
    visibleActiveItems,
  })
  const currentResourceId = getWizardEditorNavigationCurrentResourceId({ current })
  const contentItem = currentResourceId
    ? getWizardEditorStaticCatalogContentItem(catalog, currentResourceId)
    : null
  const availabilityState = resolveResourceAvailabilityState({
    lookup: { kind: 'id', id: currentResourceId as InternalResourceItemId | null | undefined },
    metadataSource: createResourceAvailabilityMetadataSource({
      catalog,
      load: { activeStatus: 'success' },
    }),
    readableItem: contentItem,
    actor: availability?.actor ?? { kind: 'owner' },
    accessTargetLabel: availability?.accessTargetLabel ?? 'you',
    isDirectMessageActor: availability?.isDirectMessageActor ?? true,
    subject: availability?.subject ?? 'item',
    fallbackLabel: unavailableResource.label,
  })

  return {
    catalog,
    current: {
      item: contentItem,
      contentItem,
      availabilityState:
        availabilityState.status === 'not_found' && !currentResourceId
          ? {
              status: 'not_found',
              label: unavailableResource.label,
              message: unavailableResource.message,
            }
          : availabilityState,
    },
    operationItems,
    paths,
  }
}

export function createWizardEditorCatalogResourceSource({
  permissions,
  snapshot,
}: WizardEditorCatalogResourceSourceInput): WizardEditorResourceSource {
  const resolvedPermissions = isWizardEditorPermissionSourceInput(permissions)
    ? createWizardEditorPermissionSource({
        ...permissions,
        getItemById: (itemId) =>
          snapshot.catalog.getKnownItemById(itemId as InternalResourceItemId),
      })
    : permissions

  return {
    catalog: snapshot.catalog,
    current: snapshot.current,
    load: createReadyFileSystemLoadState(),
    operationItems: snapshot.operationItems,
    paths: snapshot.paths,
    permissions: resolvedPermissions,
    resourceContent: createWizardEditorCatalogResourceContentSource(snapshot),
  }
}

export function createWizardEditorCatalogResourceContentSource({
  catalog,
  current,
}: Pick<WizardEditorRuntimeResourceSource, 'catalog' | 'current'>): ResourceContentSource {
  return createStaticCatalogFileSystemResourceContentSource({
    catalog,
    current,
  })
}

export function createWizardEditorSharingSource({
  blocks,
  items,
  unavailableReason,
  viewAsParticipant,
}: WizardEditorSharingSourceInput): WizardEditorSharingSource {
  const unsupported = createWizardEditorUnsupportedSharingSource(unavailableReason)

  return {
    blocks: blocks ?? unsupported,
    items: items ?? unsupported,
    viewAsParticipant: createWizardEditorViewAsParticipantSharing({
      source: viewAsParticipant,
      unsupported,
    }),
  }
}

export function createWizardEditorPermissionSource({
  actor,
  canCreateItems,
  canEdit,
  canEmptyTrash,
  canManageFolders,
  canUseWorkspaceActions,
  getItemById,
  setWorkspaceMode,
  workspaceMode,
}: WizardEditorPermissionSourceInput): WizardEditorPermissionSource {
  const normalizedPermissions = {
    actor,
    canEdit,
    canCreateItems: canCreateItems ?? canUseWorkspaceActions,
    canEmptyTrash: canEmptyTrash ?? canUseWorkspaceActions,
    canManageFolders: canManageFolders ?? canUseWorkspaceActions,
    setWorkspaceMode,
    workspaceMode,
  }
  const resolvedPermissions = createActorFileSystemPermissions({
    ...normalizedPermissions,
    getItemById,
  })

  return {
    ...resolvedPermissions,
    actor,
  }
}

export function resolveWizardEditorWorkspaceModeForItem(input: WizardEditorWorkspaceModeInput): {
  canEdit: boolean
  workspaceMode: WorkspaceMode
} {
  return resolveWorkspaceModeForItem(input)
}

export function createWizardEditorResourceAvailabilityMetadataSource(
  input: WizardEditorResourceAvailabilityMetadataSourceInput,
): WizardEditorResourceAvailabilityMetadataSource {
  const metadataSource = createResourceAvailabilityMetadataSource(input)

  return {
    owner: metadataSource.directMessage,
    participant: metadataSource.player,
    status: metadataSource.status,
  }
}

export function resolveWizardEditorResourceAvailabilityState(
  input: WizardEditorResourceAvailabilityStateInput,
): WizardEditorResourceAvailabilityState {
  return resolveResourceAvailabilityState({
    ...input,
    metadataSource: {
      directMessage: input.metadataSource.owner,
      player: input.metadataSource.participant,
      status: input.metadataSource.status,
    },
  })
}

export function createWizardEditorFileContentSource({
  canReplaceFile,
  getItemById,
  maxUploadBytes,
  readOnlyErrorMessage,
  resolveFile,
  writeFile,
}: WizardEditorFileContentSourceInput): WizardEditorFileContentSource {
  const fileIoExecutor = {
    canReplaceFile,
    getFileTargetById: (itemId: ResourceItemId) => {
      const item = getItemById(itemId)
      return item?.type === RESOURCE_TYPES.files ? item : null
    },
    maxUploadBytes,
    readOnlyErrorMessage,
    writeFile,
  }

  return {
    initializeImportedFile: ({ file, fileId, onProgress }) =>
      executeFileIoCommand({ type: 'importFile', file, fileId, onProgress }, fileIoExecutor),
    resolveFileDownloadUrl: (file) => {
      const resolvedFile = resolveFile(file)
      return resolvedFile.status === 'available' ? resolvedFile.downloadUrl : null
    },
    session: {
      maxUploadBytes,
      resolveFile,
      replaceFile: ({ file, fileId }) =>
        executeFileIoCommand(
          { type: 'replaceFile', file, fileId: fileId as InternalResourceItemId },
          fileIoExecutor,
        ),
    },
  }
}

export function runWizardEditorPdfPreviewGeneration<TItemId extends string>(input: {
  claimAndUpload: WizardEditorPreviewUpload<TItemId>
  file: {
    arrayBuffer: () => MaybePromise<ArrayBuffer>
    contentType?: string
    name: string
    size: number
    type?: string
  }
  fileId: TItemId
  options?: { signal?: AbortSignal }
  renderPdfPreview?: (source: ArrayBuffer, options?: { signal?: AbortSignal }) => Promise<Blob>
}): Promise<WizardEditorPdfPreviewGenerationResult> {
  return runPdfPreviewGeneration({
    ...input,
    claimAndUpload: (itemId, generate, options) =>
      input.claimAndUpload(itemId as unknown as TItemId, generate, options),
    fileId: input.fileId as unknown as InternalResourceItemId,
  })
}

export function replaceWizardEditorMapImage<TImage, TMapId extends string = string>(
  input: WizardEditorMapImageReplacementInput<TImage, TMapId>,
): Promise<ResourceOperationResult> {
  return replaceMapImage({
    file: input.file,
    layerId: input.layerId,
    mapId: input.mapId as unknown as InternalResourceItemId,
    stageImage: async ({ file, layerId, mapId }) => {
      const staged = await input.stageImage({
        file,
        layerId,
        mapId: mapId as unknown as TMapId,
      })
      if (staged.status !== 'staged') return staged

      return {
        ...staged,
        cancel: ({ image, layerId: stagedLayerId, mapId: stagedMapId }) =>
          staged.cancel({
            image: image as TImage,
            layerId: stagedLayerId,
            mapId: stagedMapId as unknown as TMapId,
          }),
      }
    },
    commitImage: ({ image, layerId, mapId }) =>
      input.commitImage({
        image: image as TImage,
        layerId,
        mapId: mapId as unknown as TMapId,
      }),
  })
}

export function resolveWizardEditorMapImage(
  map: WizardEditorMapImageSource,
  selectedLayerId?: string | null,
): WizardEditorResolvedMapImage {
  const resolved = resolveMapImage(map as MapImageSource, selectedLayerId)
  return {
    imageAssetId: resolved.imageAssetId,
    imageUrl: resolved.imageUrl,
    layer: resolved.layer,
  }
}

export function completeWizardEditorMapPinOperation(
  input: WizardEditorMapPinOperationInput,
): ResourceOperationResult {
  return {
    status: 'completed',
    receipt: {
      kind: input.kind,
      itemId: input.mapId,
      affectedCount: 1,
    },
  }
}

export function planWizardEditorMapPinCreations<TPin>(
  input: WizardEditorMapPinCreationsInput<TPin>,
): Array<TPin> {
  return planMapPinCreations(input)
}

export function createWizardEditorNoteYDocFromContent(content: Array<PartialNoteBlock>): Doc {
  return createNoteYDocFromContent(content)
}

export function readWizardEditorNoteYDocMarkdown(doc: Doc): string {
  return readNoteYDocMarkdown(doc)
}

export function createWizardEditorImportedTextNotePayload(
  file: WizardEditorFileSessionReplaceInput['file'],
): Promise<ImportedTextNotePayload> {
  return createImportedTextNotePayload(file)
}

export function createWizardEditorPlainTextNoteContent(input: { text: string; fileName: string }) {
  return createPlainTextNoteContent(input)
}

export function readWizardEditorResourceTransactionReceipt(
  result: unknown,
): ResourceTransactionReceipt | null {
  if (!isRecord(result)) return null
  return isWizardEditorResourceTransactionReceipt(result) ? result : null
}

function resolveWizardEditorFileDocumentSource(
  source: WizardEditorDocumentFileSourceInput,
): WizardEditorFileContentSource {
  if ('replaceFile' in source) {
    return {
      initializeImportedFile: () => ({
        status: 'unsupported',
        reason: 'file_import_unavailable',
      }),
      resolveFileDownloadUrl: (file) => {
        const resolvedFile = source.resolveFile(file)
        return resolvedFile.status === 'available' ? resolvedFile.downloadUrl : null
      },
      session: source,
    }
  }

  return createWizardEditorFileContentSource(source)
}

export function createWizardEditorRemoteDownloadSource({
  canDownloadRoot,
  loadItemsForDownload,
  loadRootItemsForDownload,
  unavailableRootReason,
}: WizardEditorRemoteDownloadSourceInput): WizardEditorRemoteDownloadSource {
  return {
    kind: 'remoteItems',
    loadItemsForDownload,
    loadRootItemsForDownload: async () => {
      if (!canDownloadRoot) {
        return { status: 'unsupported', reason: unavailableRootReason, items: [] }
      }
      return await loadRootItemsForDownload()
    },
  }
}

function isWizardEditorPermissionSourceInput(
  source: WizardEditorPermissionSource | WizardEditorCatalogPermissionSourceInput,
): source is WizardEditorCatalogPermissionSourceInput {
  return !('canAccessItem' in source)
}

function isWizardEditorSharingSourceInput(
  source: WizardEditorSharingSource | WizardEditorSharingSourceInput,
): source is WizardEditorSharingSourceInput {
  return 'unavailableReason' in source
}

export function createWizardEditorCatalogSearchSource({
  catalog,
  current,
  paths,
}: Pick<
  WizardEditorRuntimeResourceSource,
  'catalog' | 'current' | 'paths'
>): WizardEditorSearchSource {
  return {
    items: createStaticCatalogFileSystemSearch({
      catalog,
      createSearch: createCatalogFileSystemSearch,
      createSearchResult: createCatalogItemSearchResult,
      currentContentItem: current.contentItem,
      paths,
    }),
  }
}

export function useWizardEditorHydratedCatalogSearchSource<SourceId extends string>(
  input: WizardEditorHydratedCatalogSearchSourceInput<SourceId>,
): WizardEditorSearchSource {
  return {
    items: useHydratedCatalogFileSystemSearch({
      catalog: input.catalog,
      createSearch: createCatalogFileSystemSearch,
      itemLinks: input.itemLinks,
      recentItems: input.recentItems,
      revision: input.revision,
      searchBody: input.searchBody,
      sourceId: input.sourceId,
    }),
  }
}

export function useWizardEditorHydratedCatalogResourceContentSource<SourceId extends string>(
  input: WizardEditorHydratedCatalogResourceContentSourceInput<SourceId>,
): ResourceContentSource {
  return useHydratedCatalogFileSystemResourceContentSource({
    catalog: input.catalog,
    current: input.current,
    loadItemContent: input.loadItemContent,
    contentProjection: input.contentProjection
      ? {
          canAccessItem: input.contentProjection.canAccessItem,
          getMemberItemPermissionLevel: input.contentProjection.getMemberItemPermissionLevel,
          viewAsPlayerId: input.contentProjection.viewAsParticipantId as
            | InternalParticipantId
            | undefined,
        }
      : undefined,
    sourceId: input.sourceId,
  })
}

export function createWizardEditorCatalogIoSource(
  {
    catalog,
    operationItems,
  }: Pick<WizardEditorRuntimeResourceSource, 'catalog' | 'operationItems'>,
  download: WizardEditorCatalogDownloadSourceInput,
): WizardEditorIoSource {
  const fileContent = resolveWizardEditorFileDocumentSource(download.file)

  return {
    download: createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: download.resolveCanvasDownloadContent,
      resolveFileDownloadUrl: fileContent.resolveFileDownloadUrl,
      resolveMapDownloadUrl: download.resolveMapDownloadUrl,
    }),
  }
}

export function createWizardEditorUnsupportedHistorySource(
  reason: Extract<WizardEditorHistorySource, { status: 'unsupported' }>['reason'],
): WizardEditorHistorySource {
  return { status: 'unsupported', reason }
}

export function resolveWizardEditorHistoryScope(
  input: WizardEditorHistoryScopeInput,
): WizardEditorHistoryScope {
  return resolveResourceHistoryScope(input)
}

export function createWizardEditorHistorySource(
  input: WizardEditorHistoryInput,
): WizardEditorHistorySource {
  return createResourceFileSystemHistory(input)
}

function resolveWizardEditorDownloadSource(
  download: WizardEditorDownloadSource,
): FileSystemDownload {
  if (!('kind' in download)) return download

  return {
    status: 'available',
    loadItemsForDownload: async (input) =>
      completeWizardEditorRemoteDownloadResult(await download.loadItemsForDownload(input)),
    loadRootItemsForDownload: async () =>
      completeWizardEditorRemoteDownloadResult(await download.loadRootItemsForDownload()),
  }
}

function completeWizardEditorRemoteDownloadResult(
  result: WizardEditorRemoteDownloadResult,
): Awaited<ReturnType<WizardEditorAvailableDownload['loadRootItemsForDownload']>> {
  if ('status' in result) return result

  return {
    status: 'completed',
    receipt: { kind: 'downloadPrepared', affectedCount: result.items.length },
    items: result.items,
    skippedItems: [],
  }
}

function createReadyFileSystemLoadState(): WizardEditorRuntimeFilesystemSource['load'] {
  return {
    activeError: null,
    activeStatus: 'success',
    refreshActive: () => Promise.resolve(),
    refreshTrash: () => Promise.resolve(),
    trashError: null,
    trashStatus: 'success',
  }
}

function toWizardEditorDocumentSource(
  source: WizardEditorInternalDocumentSource,
): WizardEditorDocumentSource {
  return {
    ...source,
    canvas: toWizardEditorCanvasSessionPorts(source.canvas),
  }
}

function toInternalWizardEditorDocumentSource(
  source: WizardEditorDocumentSource,
): WizardEditorInternalDocumentSource {
  return {
    ...source,
    canvas: toInternalCanvasSessionPorts(source.canvas),
  }
}

function toWizardEditorCanvasSessionPorts(
  source: WizardEditorInternalDocumentSource['canvas'],
): WizardEditorCanvasSessionPorts {
  return {
    document: {
      useCanvasDocumentSession: (canvas) => source.document.useCanvasDocumentSession(canvas),
    },
  }
}

function toInternalCanvasSessionPorts(
  source: WizardEditorCanvasSessionPorts,
): WizardEditorInternalDocumentSource['canvas'] {
  return {
    document: {
      useCanvasDocumentSession: (canvas) => source.document.useCanvasDocumentSession(canvas),
    },
  }
}

function createWizardEditorCommandCapability(
  isAvailable: boolean,
  unavailableReason: string,
): ResourceCommandCapabilities['createItems'] {
  return isAvailable
    ? { status: 'available' }
    : { status: 'unsupported', reason: unavailableReason }
}

function isWizardEditorResourceTransactionReceipt(
  result: Record<string, unknown>,
): result is ResourceTransactionReceipt {
  return (
    (result.transactionId === null || typeof result.transactionId === 'string') &&
    (result.direction === 'forward' ||
      result.direction === 'undo' ||
      result.direction === 'redo') &&
    isWizardEditorResourceCommand(result.command) &&
    Array.isArray(result.events) &&
    Array.isArray(result.patches) &&
    isWizardEditorResourceReceiptSummary(result.summary) &&
    typeof result.undoable === 'boolean'
  )
}

function isWizardEditorResourceCommand(command: unknown): command is ResourceCommand {
  if (!isRecord(command)) return false
  return Object.values(RESOURCE_COMMAND_TYPE).includes(command.type as ResourceCommand['type'])
}

function isWizardEditorResourceReceiptSummary(summary: unknown) {
  if (!isRecord(summary)) return false
  return (
    typeof summary.kind === 'string' &&
    typeof summary.affectedCount === 'number' &&
    typeof summary.createdCount === 'number' &&
    typeof summary.mergedCount === 'number' &&
    typeof summary.skippedCount === 'number'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readWizardEditorGameMapPins(
  item: WizardEditorItem | null | undefined,
): Array<Pick<MapItemWithContent['pins'][number], 'id' | 'itemId'>> | null {
  if (!isWizardEditorGameMapItem(item)) return null
  const pins = (item as Partial<MapItemWithContent>).pins
  return Array.isArray(pins) ? pins : []
}

function createWizardEditorUnsupportedSharingSource(
  reason: UnsupportedSharingSource['reason'],
): UnsupportedSharingSource {
  return { status: 'unsupported', reason }
}

function createWizardEditorViewAsParticipantSharing({
  source,
  unsupported,
}: {
  source: WizardEditorSharingSourceInput['viewAsParticipant']
  unsupported: UnsupportedSharingSource
}): WizardEditorSharingSource['viewAsParticipant'] {
  if (!source?.canUse || !source.setSelectedParticipantId) return unsupported

  const resolveParticipantId = (participantId: EditorShareParticipantId | undefined) =>
    source.isPending ||
    (participantId && source.participants.some((participant) => participant.id === participantId))
      ? participantId
      : undefined

  return {
    status: 'available',
    isPending: source.isPending,
    participants: source.participants,
    selectedParticipantId: resolveParticipantId(source.selectedParticipantId),
    setSelectedParticipantId: (participantId) =>
      source.setSelectedParticipantId?.(resolveParticipantId(participantId)),
  }
}

function getWizardEditorStaticCatalogContentItem(
  catalog: ResourceCatalog,
  resourceId: ResourceId,
): WizardEditorItemWithContent | null {
  const visibleItem = catalog.getVisibleItemById(resourceId as InternalResourceItemId)
  if (isWizardEditorItemWithContent(visibleItem)) return visibleItem

  const knownItem = catalog.getKnownItemById(resourceId as InternalResourceItemId)
  return knownItem?.isTrashed && isWizardEditorItemWithContent(knownItem) ? knownItem : null
}

export function createWizardEditorResource(resourceId: ResourceId): WizardEditorResource {
  return createWorkspaceResource(resourceId)
}

export function getWizardEditorResourceId(resource: WizardEditorResource): ResourceId {
  return getWorkspaceResourceId(resource as WorkspaceResource)
}

export function getWizardEditorNavigationCurrentResourceId({
  current,
}: {
  current: WizardEditorNavigationState
}) {
  return getWorkspaceNavigationCurrentResourceId({ current: current as WorkspaceNavigationState })
}

export function resolveWizardEditorNavigationState(
  input: WizardEditorNavigationStateResolutionInput,
): WizardEditorNavigationState {
  return resolveWorkspaceNavigationState(
    input as Omit<WizardEditorNavigationStateResolutionInput, 'resource'> & {
      resource: WorkspaceResource | null
    },
  )
}
