import type { ResourceId } from '../resources/domain-id'
import { WORKSPACE_MODE } from '../../../../shared/workspace/workspace-mode'
import { hasPermissionForRequirement } from '../../../../shared/permissions/requirements'
import { PERMISSION_LEVEL, PERMISSION_RANK } from '../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import { isResourceItemWithContent } from '../workspace/items'
import type { AnyItem, AnyItemWithContent } from '../workspace/items'

import type { WorkspaceMode } from '../../../../shared/workspace/workspace-mode'
import { createResourceCatalogModel } from '../filesystem/catalog'
import { createStaticCatalogFileSystemResourceContentSource } from '../filesystem/resource-content-source'
import type { ResourceAvailabilityState } from '../filesystem/domain/availability-state'
import type { FileSystemOperations } from '../filesystem/operations'
import type {
  BlocksShareSource,
  ResourceShareSource,
  ViewAsParticipantCapability,
} from '../sharing/contracts'
import type { FileSystemDownload } from '../filesystem/download'
import type { ResourceHistory } from '../filesystem/history-types'
import type { FileSystemSearch } from '../filesystem/search'
import type { ResourceContentSource } from '../filesystem/resource-content-source'
import type { FileSystemLoadState } from '../filesystem/load-state'
import { createCurrentItemFileSystemSelection } from '../filesystem/selection'
import type { FileSystemSelection } from '../filesystem/selection'
import type { FileSystemPermissions } from '../filesystem/permissions'
import { createWorkspaceResource, createWorkspaceRuntime } from '../workspace/runtime'
import type {
  WorkspaceNavigation,
  WorkspaceNavigationState,
  WorkspaceRuntime,
} from '../workspace/runtime'
import type { WorkspaceViewStateStores } from '../workspace/runtime-host'
import type { FileSession } from '../files/session-contract'
import type { MapSession } from '../game-maps/session-contract'
import type {
  CanvasEmbeddedSessionPorts,
  CanvasSessionPorts,
} from '../canvas/workspace-session-source'
import type { PreviewUploadCapability } from '../files/preview-upload-contract'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../notes/workspace-session-source'
import { completedResourceOperation } from '../filesystem/transaction-contract'
import {
  createTestNoteHeadingSessionPorts,
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteValueSessionPorts,
} from './workspace-note-session-source-factory'
import {
  createTestCanvasEmbeddedSessionPorts,
  createTestCanvasSessionPorts,
} from './workspace-canvas-session-source-factory'
import {
  createMemoryCanvasViewportStore,
  createMemoryMapTransformStore,
  createMemoryNoteScrollStore,
} from './view-state-store-factory'

export function createMemoryWorkspaceViewStateStores(): WorkspaceViewStateStores {
  return {
    canvasViewport: createMemoryCanvasViewportStore(),
    mapTransform: createMemoryMapTransformStore(),
    noteScroll: createMemoryNoteScrollStore(),
  }
}

function missingTestFilesystemOperation(operationName: string): never {
  throw new Error(
    `Test workspace runtime operation "${operationName}" was used without an implementation`,
  )
}

export function createTestWorkspaceRuntime({
  activeItems,
  activeError,
  activeStatus,
  availabilityState,
  blockSharing = { status: 'unsupported', reason: 'not_available' },
  canAccessItem,
  canCreateItems = false,
  canEdit = true,
  canEmptyTrash,
  canManageFolders,
  canMutateItem,
  canvasEmbedded = createTestCanvasEmbeddedSessionPorts(),
  canvasPreviewUpload = { status: 'unsupported' },
  canvasSession = createTestCanvasSessionPorts(),
  contentItem,
  currentNavigation,
  download = { status: 'unsupported', reason: 'not_available' },
  fileSession = createTestFileSessionSource(),
  history = { status: 'unsupported', reason: 'not_implemented' },
  item = null,
  mapSession = createTestGameMapSessionSource(),
  navigation = {},
  noteHeadings = createTestNoteHeadingSessionPorts(),
  notePlayback = createTestNotePlaybackSessionPorts(),
  noteSession = createTestNoteSessionPorts(),
  noteValues = createTestNoteValueSessionPorts(),
  operations = {},
  refreshActive,
  resourceContent,
  search = { status: 'unsupported', reason: 'not_implemented' },
  selection = {},
  selectedItemIds,
  sharing = { status: 'unsupported', reason: 'not_available' },
  trashItems = [],
  viewAsParticipant = { status: 'unsupported', reason: 'not_available' },
  workspaceMode = WORKSPACE_MODE.EDITOR,
  workspaceId = 'test-workspace',
}: {
  activeItems?: Array<AnyItem>
  activeError?: Error | null
  activeStatus?: FileSystemLoadState['activeStatus']
  availabilityState?: ResourceAvailabilityState
  blockSharing?: BlocksShareSource
  canAccessItem?: (item: AnyItem, requiredLevel: PermissionLevel) => boolean
  canCreateItems?: boolean
  canEdit?: boolean
  canEmptyTrash?: boolean
  canManageFolders?: boolean
  canMutateItem?: (item: AnyItem, requiredLevel: PermissionLevel) => boolean
  canvasEmbedded?: CanvasEmbeddedSessionPorts
  canvasPreviewUpload?: PreviewUploadCapability
  canvasSession?: CanvasSessionPorts
  contentItem?: AnyItemWithContent | null
  currentNavigation?: WorkspaceNavigationState
  download?: FileSystemDownload
  fileSession?: FileSession
  history?: ResourceHistory
  item?: AnyItem | null
  mapSession?: MapSession
  navigation?: Partial<WorkspaceNavigation>
  noteHeadings?: NoteHeadingSessionPorts
  notePlayback?: NotePlaybackSessionPorts
  noteSession?: NoteSessionPorts
  noteValues?: NoteValueSessionPorts
  operations?: Partial<FileSystemOperations>
  refreshActive?: FileSystemLoadState['refreshActive']
  resourceContent?: ResourceContentSource
  search?: FileSystemSearch
  selection?: Partial<FileSystemSelection>
  selectedItemIds?: Array<ResourceId>
  sharing?: ResourceShareSource
  trashItems?: Array<AnyItem>
  viewAsParticipant?: ViewAsParticipantCapability
  workspaceMode?: WorkspaceMode
  workspaceId?: string
} = {}): WorkspaceRuntime {
  const activeCatalogItems = activeItems ?? (item ? [item] : [])
  const { catalog, operationItems, paths } = createResourceCatalogModel({
    activeItems: activeCatalogItems,
    trashItems,
  })
  const load = {
    ...createReadyFileSystemLoadState(),
    ...(activeError !== undefined ? { activeError } : {}),
    ...(activeStatus !== undefined ? { activeStatus } : {}),
    ...(refreshActive !== undefined ? { refreshActive } : {}),
  }
  const resolvedContentItem = contentItem ?? (isResourceItemWithContent(item) ? item : null)
  const currentAvailabilityState: ResourceAvailabilityState =
    availabilityState ??
    (resolvedContentItem
      ? { status: 'available', label: resolvedContentItem.name, item: resolvedContentItem }
      : {
          status: 'not_found',
          label: item?.name ?? 'Page',
          message: 'Page not found.',
        })
  const navigationState: WorkspaceNavigationState =
    currentNavigation ??
    (item ? { kind: 'resource', resource: createWorkspaceResource(item.id) } : { kind: 'empty' })
  const defaultSelection = createTestFileSystemSelection({
    currentItemId: item?.id ?? null,
    fallbackSelectedItemIds: selectedItemIds ?? (item ? [item.id] : []),
  })
  const permissions = createItemLevelFileSystemPermissions({
    canEdit,
    canCreateItems,
    canEmptyTrash: canEmptyTrash ?? canEdit,
    canManageFolders: canManageFolders ?? canEdit,
    resolveMemberItemPermissionLevel: getMemberItemPermissionLevel,
    setWorkspaceMode: () => undefined,
    workspaceMode,
  })
  const resourceContentSource =
    resourceContent ??
    createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: {
        item,
        contentItem: resolvedContentItem,
        availabilityState: currentAvailabilityState,
      },
    })

  const runtime = createWorkspaceRuntime({
    workspaceId,
    filesystem: {
      catalog,
      operationItems,
      paths,
      load,
      current: {
        item,
        contentItem: resolvedContentItem,
        availabilityState: currentAvailabilityState,
      },
      operations: {
        clipboard: { status: 'unsupported' },
        history: {
          canUndo: false,
          canRedo: false,
          undo: () => ({ status: 'unavailable', reason: 'history_unsupported' }),
          redo: () => ({ status: 'unavailable', reason: 'history_unsupported' }),
        },
        createItem: () => missingTestFilesystemOperation('createItem'),
        updateItemMetadata: () => missingTestFilesystemOperation('updateItemMetadata'),
        executeDropCommand: () => missingTestFilesystemOperation('executeDropCommand'),
        toggleBookmarks: () => missingTestFilesystemOperation('toggleBookmarks'),
        trashItems: () => missingTestFilesystemOperation('trashItems'),
        restoreItems: () => missingTestFilesystemOperation('restoreItems'),
        requestDeleteItemsForever: () =>
          missingTestFilesystemOperation('requestDeleteItemsForever'),
        requestEmptyTrash: () => missingTestFilesystemOperation('requestEmptyTrash'),
        canPasteIntoTarget: () => false,
        pasteIntoTarget: () => missingTestFilesystemOperation('pasteIntoTarget'),
        importFile: () => missingTestFilesystemOperation('importFile'),
        importDrop: () => missingTestFilesystemOperation('importDrop'),
        validateCreateItem: () => ({ valid: true }),
        ...operations,
      },
      permissions: {
        ...permissions,
        ...(canAccessItem ? { canAccessItem } : {}),
        ...(canMutateItem ? { canMutateItem } : {}),
      },
      sharing: {
        blocks: blockSharing,
        items: sharing,
        viewAsParticipant,
      },
      search,
      resourceContent: resourceContentSource,
      download,
      history,
    },
    sessions: {
      canvas: canvasSession,
      canvasEmbedded,
      canvasPreviewUpload,
      file: fileSession,
      map: mapSession,
      note: noteSession,
      noteHeadings,
      notePlayback,
      noteValues,
    },
    navigation: {
      canOpenItemsSeparately: { status: 'unsupported', reason: 'not_available' },
      current: navigationState,
      openCreateDashboard: () => ({ status: 'completed' }),
      openDefaultItem: () => ({ status: 'completed' }),
      openItem: () => ({ status: 'completed' }),
      openExternalUrl: () => ({ status: 'completed' }),
      openTrash: () => ({ status: 'completed' }),
      ...navigation,
    },
  })

  return {
    ...runtime,
    filesystem: {
      ...runtime.filesystem,
      selection: { ...defaultSelection, ...selection },
    },
  }
}

function createItemLevelFileSystemPermissions({
  canEdit,
  canCreateItems = canEdit,
  canEmptyTrash = canEdit,
  canManageFolders = canEdit,
  resolveMemberItemPermissionLevel,
  setWorkspaceMode,
  workspaceMode,
}: {
  canEdit: boolean
  canCreateItems?: boolean
  canEmptyTrash?: boolean
  canManageFolders?: boolean
  resolveMemberItemPermissionLevel?: (item: AnyItem, participantId: string) => PermissionLevel
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  workspaceMode: WorkspaceMode
}): FileSystemPermissions {
  const getEffectiveItemPermissionLevel = (itemLevel: PermissionLevel) =>
    canEdit ? itemLevel : minPermissionLevel(itemLevel, PERMISSION_LEVEL.VIEW)

  return {
    workspaceMode: canEdit ? workspaceMode : WORKSPACE_MODE.VIEWER,
    setWorkspaceMode: (mode) => {
      if (canEdit) setWorkspaceMode(mode)
    },
    canEdit,
    canCreateItems: canEdit && canCreateItems,
    canEmptyTrash: canEdit && canEmptyTrash,
    canManageFolders: canEdit && canManageFolders,
    canAccessItem: (item, requiredLevel) =>
      hasPermissionForRequirement(
        getEffectiveItemPermissionLevel(item.myPermissionLevel),
        requiredLevel,
      ),
    canMutateItem: (item, requiredLevel) =>
      canEdit &&
      hasPermissionForRequirement(
        getEffectiveItemPermissionLevel(item.myPermissionLevel),
        requiredLevel,
      ),
    getMemberItemPermissionLevel: (item, memberId) =>
      getEffectiveItemPermissionLevel(
        resolveMemberItemPermissionLevel?.(item, memberId) ?? PERMISSION_LEVEL.NONE,
      ),
  }
}

function minPermissionLevel(left: PermissionLevel, right: PermissionLevel): PermissionLevel {
  return PERMISSION_RANK[left] <= PERMISSION_RANK[right] ? left : right
}

function createTestFileSessionSource(): FileSession {
  return {
    replaceFile: ({ fileId }) => ({
      status: 'completed',
      receipt: {
        kind: 'fileReplaced',
        itemId: fileId,
        affectedCount: 1,
      },
    }),
    resolveFile: (file) => {
      if (file.downloadUrl) {
        return {
          allowObjectUrl: false,
          contentType: file.contentType,
          downloadUrl: file.downloadUrl,
          name: file.name,
          size: null,
          status: 'available',
        }
      }
      if (file.assetId) {
        return {
          allowObjectUrl: false,
          contentType: file.contentType,
          downloadUrl: null,
          name: file.name,
          reason: 'missing',
          size: null,
          status: 'unavailable',
        }
      }
      return {
        allowObjectUrl: false,
        contentType: file.contentType,
        downloadUrl: null,
        name: file.name,
        size: null,
        status: 'unattached',
      }
    },
  }
}

function createReadyFileSystemLoadState(): FileSystemLoadState {
  return {
    activeStatus: 'success',
    activeError: null,
    refreshActive: () => Promise.resolve(),
    refreshTrash: () => Promise.resolve(),
    trashError: null,
    trashStatus: 'success',
  }
}

function createTestFileSystemSelection({
  currentItemId,
  fallbackSelectedItemIds,
}: {
  currentItemId: ResourceId | null
  fallbackSelectedItemIds: Array<ResourceId>
}): FileSystemSelection {
  const selection = createCurrentItemFileSystemSelection(
    currentItemId ? { id: currentItemId } : null,
  )
  selection.setSelectedItemIds(fallbackSelectedItemIds, currentItemId)
  return selection
}

function createTestGameMapSessionSource(): MapSession {
  return {
    pins: {
      create: () => ({
        status: 'completed',
        receipt: {
          kind: 'mapPinsCreated',
          itemId: 'test-map' as ResourceId,
          affectedCount: 0,
          pinIds: [],
        },
      }),
      update: () =>
        completedResourceOperation({
          kind: 'mapPinUpdated',
          affectedCount: 1,
        }),
      setVisibility: () =>
        completedResourceOperation({
          kind: 'mapPinVisibilityUpdated',
          affectedCount: 1,
        }),
      remove: () =>
        completedResourceOperation({
          kind: 'mapPinRemoved',
          affectedCount: 1,
        }),
    },
    updateMapImage: () =>
      completedResourceOperation({
        kind: 'mapImageUpdated',
        affectedCount: 1,
      }),
  }
}

function getMemberItemPermissionLevel(item: AnyItem, memberId: string): PermissionLevel {
  const directShare = item.shares.find((share) => share.campaignMemberId === memberId)
  return directShare?.permissionLevel ?? item.allPermissionLevel ?? PERMISSION_LEVEL.NONE
}
