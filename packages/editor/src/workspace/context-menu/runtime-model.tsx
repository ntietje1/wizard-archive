import { createWorkspaceResource } from '../runtime'
import type { WorkspaceNavigation, WorkspaceRuntime } from '../runtime'
import { createElement, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { AnyItem } from '../items'
import { reportShareActionFailure, useWorkspaceContextMenuActions } from './use-actions'
import { projectFileSystemActionItem } from '../../filesystem/action-item'
import { workspaceContextMenuCommands, workspaceContextMenuContributors } from './registry'
import type { WorkspaceContextMenuServices } from './registry'
import { workspaceContextMenuGroupConfig } from './group-config'
import type { WorkspaceItemEditContextMenuServices } from './item-edit-menu'
import {
  mapPinContextMenuCommands,
  mapPinContextMenuContributors,
} from '../../game-maps/context-menu/menu'
import type { WorkspaceMapPinContextMenuServices } from '../../game-maps/context-menu/menu'
import type { WorkspaceMenuContext } from '../menu-context'
import type {
  WorkspaceContextMenuModel,
  WorkspaceContextMenuModelOptions,
} from '../context-menu-model-source'
import { useBlocksShare } from '../../sharing/block/use-share'
import { SidebarItemEditDialog } from '../sidebar/forms/sidebar-item-edit-dialog'
import { createEditFileSystemItem } from '../../filesystem/edit-item'
import { isFileItem, isMapItem } from '../sidebar/utils/sidebar-item-types'
import { buildWorkspaceContextMenuModel, useWorkspaceContextMenuBase } from '../context-menu-model'
import { createMapPinActions } from '../../game-maps/context-menu/actions'
import { createMapPinMenuService } from '../../game-maps/context-menu/service'
import { useMapPinMenuServiceState } from '../../game-maps/context-menu/use-service-state'
import {
  getNoteBlockShareTargetsFromFields,
  getNoteBlockShareTargetsFromMenuContext,
  useNoteWorkspaceMenuContextFields,
} from '../../notes/context-menu/note-menu-context'
import type { NoteBlockShareTargets } from '../../notes/context-menu/note-menu-context'
import { createRightSidebarPanelMenuService } from '../right-sidebar/panel-menu-service'
import { handleError } from '../../errors/handle-error'
import { SidebarItemsSharePanel } from '../../sharing/sidebar-items/panel'
import { RuntimeFileEditDialog, RuntimeMapEditDialog } from './runtime-edit-dialogs'
import { createWorkspaceFilesystemContextMenuTarget } from './filesystem-target'
import { usePanelPreferenceStoreApi } from '@wizard-archive/ui/panel-preferences/store'
import type { EditFileSystemItemFn } from '../../filesystem/edit-item'
import type { ResourceCatalog, ResourceOperationItems } from '../../filesystem/catalog'
import type { FileSystemItemContextMenuOperations } from '../../filesystem/item-operation-contracts'
import type {
  BlocksShareSource,
  ResourceShareSource,
  ViewAsParticipantCapability,
} from '../../sharing/contracts'
import type { FileSystemDownload } from '../../filesystem/download'
import type { FileSystemLoadState } from '../../filesystem/load-state'
import type { FileSystemSelection } from '../../filesystem/selection'
import type { FileSession } from '../../files/session-contract'
import type { MapSession } from '../../game-maps/session-contract'
import type { FileSystemPermissions } from '../../filesystem/permissions'
import { getRuntimeRightSidebarAvailablePanels } from '../right-sidebar/runtime-source'

type BlockShareAllPlayersPermissionLevel = 'hidden' | 'visible' | 'mixed'

interface OptimisticBlockSharePermission {
  targetKey: string
  permissionLevel: Exclude<BlockShareAllPlayersPermissionLevel, 'mixed'>
}

export type WorkspaceRuntimeContextMenuModelInput = {
  navigation: Pick<WorkspaceNavigation, 'canOpenItemsSeparately' | 'current' | 'openItem'>
  filesystem: {
    catalog: Pick<
      ResourceCatalog,
      'getKnownItemById' | 'getVisibleAncestors' | 'getVisibleChildren'
    >
    download: FileSystemDownload
    current: WorkspaceRuntime['filesystem']['current']
    history: WorkspaceRuntime['filesystem']['history']
    load: Pick<FileSystemLoadState, 'activeStatus'>
    operationItems: Pick<ResourceOperationItems, 'resolveItems'>
    operations: FileSystemItemContextMenuOperations
    permissions: Pick<
      FileSystemPermissions,
      | 'canAccessItem'
      | 'canCreateItems'
      | 'canEdit'
      | 'canEmptyTrash'
      | 'canManageFolders'
      | 'canMutateItem'
      | 'setWorkspaceMode'
      | 'workspaceMode'
    >
    selection: Pick<FileSystemSelection, 'selectedItemIds'>
    search: WorkspaceRuntime['filesystem']['search']
    sharing: {
      blocks: BlocksShareSource
      items: ResourceShareSource
      viewAsParticipant: ViewAsParticipantCapability
    }
  }
  sessions: {
    file: Pick<FileSession, 'replaceFile'>
    map: Pick<MapSession, 'updateMapImage'>
  }
}

export function useWorkspaceRuntimeContextMenuModel(
  {
    contextOverrides,
    ref,
    viewContext,
    item,
    onDialogOpen,
    onDialogClose,
  }: WorkspaceContextMenuModelOptions,
  runtime: WorkspaceRuntimeContextMenuModelInput,
): {
  dialogs: ReactNode
  model: WorkspaceContextMenuModel
} {
  const {
    filesystem: {
      catalog,
      download,
      load,
      operationItems,
      operations,
      permissions,
      selection,
      sharing,
    },
    navigation,
    sessions,
  } = runtime
  const blockSharing = sharing.blocks
  const panelPreferences = usePanelPreferenceStoreApi()
  const availableRightSidebarPanels = getRuntimeRightSidebarAvailablePanels(runtime)
  const sidebarItemSharing = sharing.items
  const sidebarItemSharingService =
    sidebarItemSharing.status === 'available'
      ? {
          status: 'available' as const,
          renderPanel: (items: Array<AnyItem>) =>
            sidebarItemSharing.renderItemsShareState(items, (state) =>
              createElement(SidebarItemsSharePanel, { items, state }),
            ),
        }
      : { status: 'unsupported' as const, reason: sidebarItemSharing.reason }
  const mapPinContextMenu = useRuntimeMapPinContextMenu(runtime)
  const noteMenuContext = useNoteWorkspaceMenuContextFields()
  const base = useWorkspaceContextMenuBase({
    itemSource: {
      selectedItemIds: selection.selectedItemIds,
      resolveOperationItems: operationItems.resolveItems,
    },
    options: { ref, viewContext, item, onDialogOpen, onDialogClose },
    projectItem: (candidate) => projectFileSystemActionItem(candidate, permissions),
    contextOverrides: {
      ...contextOverrides,
      domainContext: noteMenuContext,
      permissionLevel: item
        ? projectFileSystemActionItem(item, permissions).myPermissionLevel
        : undefined,
      rootOperations: {
        canDownloadAll: permissions.canCreateItems,
      },
    },
  })
  const filesystem = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)
  const menuActions = useWorkspaceContextMenuActions({
    filesystem,
    onDialogOpen,
    source: {
      catalog,
      canOpenItemsSeparately: navigation.canOpenItemsSeparately,
      createItem: operations.createItem,
      download,
      openItem: navigation.openItem,
      sharing: sharing.items,
      toggleBookmarks: operations.toggleBookmarks,
    },
  })
  const editDialogFilesystem = {
    catalog: { getKnownItemById: catalog.getKnownItemById },
    load: { activeStatus: load.activeStatus },
    operations: {
      createItem: operations.createItem,
      updateItemMetadata: operations.updateItemMetadata,
      validateItemName: operations.validateItemName,
    },
  }
  const editDialogs = useRuntimeItemEditDialogs(
    {
      editItem: createEditFileSystemItem({
        catalog: { getVisibleChildren: catalog.getVisibleChildren },
        operations: { updateItemMetadata: operations.updateItemMetadata },
        permissions: { canMutateItem: permissions.canMutateItem },
      }),
      fileDialogRuntime: {
        navigation: { openItem: navigation.openItem },
        filesystem: editDialogFilesystem,
        sessions: { file: { replaceFile: sessions.file.replaceFile } },
      },
      mapDialogRuntime: {
        filesystem: editDialogFilesystem,
        sessions: { map: { updateMapImage: sessions.map.updateMapImage } },
      },
    },
    {
      onDialogOpen,
      onDialogClose,
      scope: viewContext,
    },
  )
  const viewAsParticipant = sharing.viewAsParticipant
  const blockShareService = useRuntimeBlockShareService(blockSharing, noteMenuContext)
  const workspaceServices: WorkspaceContextMenuServices = {
    actions: {
      ...menuActions,
      itemEdit: editDialogs.actions,
    },
    canCreateItems: permissions.canCreateItems,
    filesystem,
    workspaceMode: {
      workspaceMode: permissions.workspaceMode,
      canEdit: permissions.canEdit,
      setWorkspaceMode: permissions.setWorkspaceMode,
    },
    viewAsPlayer:
      viewAsParticipant.status === 'available'
        ? {
            status: 'available' as const,
            viewAsPlayerId: viewAsParticipant.selectedParticipantId,
            playerMembers: viewAsParticipant.participants,
            setViewAsPlayerId: viewAsParticipant.setSelectedParticipantId,
          }
        : { status: 'unsupported' as const, reason: viewAsParticipant.reason },
    sidebarItemSharing: sidebarItemSharingService,
    blockShare: {
      canOpen: blockShareService.canOpen,
      canToggleAllPlayersPermission: blockShareService.canToggleAllPlayersPermission,
      getBlockCount: (context) => getContextMenuBlockShareTargets(context).length,
      getAllPlayersPermissionLevel: blockShareService.getAllPlayersPermissionLevel,
      toggleAllPlayersPermission: blockShareService.toggleAllPlayersPermission,
    },
    panels: createRightSidebarPanelMenuService(panelPreferences, availableRightSidebarPanels),
  }

  return createWorkspaceRuntimeContextMenuModel({
    base,
    dialogs: editDialogs.dialogs,
    mapPinContextMenu,
    workspaceServices,
  })
}

function createWorkspaceRuntimeContextMenuModel({
  base,
  dialogs,
  mapPinContextMenu,
  workspaceServices,
}: {
  base: ReturnType<typeof useWorkspaceContextMenuBase>
  dialogs: ReactNode
  mapPinContextMenu: RuntimeMapPinContextMenu | null
  workspaceServices: WorkspaceContextMenuServices
}): {
  dialogs: ReactNode
  model: WorkspaceContextMenuModel
} {
  if (mapPinContextMenu) {
    return {
      dialogs,
      model: buildWorkspaceContextMenuModel<
        WorkspaceContextMenuServices & WorkspaceMapPinContextMenuServices
      >({
        base,
        contributors: [...workspaceContextMenuContributors, ...mapPinContextMenuContributors],
        commands: {
          ...workspaceContextMenuCommands,
          ...mapPinContextMenuCommands,
        },
        groupConfig: workspaceContextMenuGroupConfig,
        services: {
          ...workspaceServices,
          actions: {
            ...workspaceServices.actions,
            mapPins: mapPinContextMenu.actions,
          },
          mapPins: mapPinContextMenu.service,
        },
      }),
    }
  }

  return {
    dialogs,
    model: buildWorkspaceContextMenuModel<WorkspaceContextMenuServices>({
      base,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
      services: workspaceServices,
    }),
  }
}

interface RuntimeItemEditDialogs {
  actions: WorkspaceItemEditContextMenuServices['actions']['itemEdit']
  dialogs: ReactNode
}

type RuntimeItemEditDialogsInput = {
  editItem: EditFileSystemItemFn
  fileDialogRuntime: Parameters<typeof RuntimeFileEditDialog>[0]['runtime']
  mapDialogRuntime: Parameters<typeof RuntimeMapEditDialog>[0]['runtime']
}

type RuntimeItemEditDialogState =
  | { kind: 'map'; itemId: SidebarItemId }
  | { kind: 'file'; itemId: SidebarItemId }
  | { kind: 'item'; item: AnyItem }

type RuntimeItemEditDialogScope = WorkspaceContextMenuModelOptions['viewContext']

interface RuntimeItemEditDialogRecord {
  dialog: RuntimeItemEditDialogState
  scope: RuntimeItemEditDialogScope
}

function useRuntimeItemEditDialogs(
  source: RuntimeItemEditDialogsInput,
  {
    onDialogClose,
    onDialogOpen,
    scope,
  }: {
    onDialogClose?: () => void
    onDialogOpen?: () => void
    scope: RuntimeItemEditDialogScope
  },
): RuntimeItemEditDialogs {
  const [editDialog, setEditDialog] = useState<RuntimeItemEditDialogRecord | null>(null)
  const closedDialogScopeRef = useRef<RuntimeItemEditDialogScope | null>(null)
  const hasOpenDialogRef = useRef(false)
  const openDialogScopeRef = useRef(scope)
  const onDialogCloseRef = useRef(onDialogClose)
  onDialogCloseRef.current = onDialogClose

  const closeTrackedDialog = () => {
    if (!hasOpenDialogRef.current) return
    hasOpenDialogRef.current = false
    onDialogCloseRef.current?.()
  }
  const openEditDialog = (nextEditDialog: RuntimeItemEditDialogState) => {
    closedDialogScopeRef.current = null
    openDialogScopeRef.current = scope
    setEditDialog({ dialog: nextEditDialog, scope })
    if (!hasOpenDialogRef.current) {
      hasOpenDialogRef.current = true
      onDialogOpen?.()
    }
  }
  const closeEditDialog = () => {
    setEditDialog(null)
    closeTrackedDialog()
  }

  useEffect(
    () => () => {
      if (!hasOpenDialogRef.current) return
      hasOpenDialogRef.current = false
      onDialogCloseRef.current?.()
    },
    [],
  )
  useEffect(() => {
    if (Object.is(openDialogScopeRef.current, scope) || !hasOpenDialogRef.current) return
    closedDialogScopeRef.current = openDialogScopeRef.current
    hasOpenDialogRef.current = false
    onDialogCloseRef.current?.()
  }, [scope])

  const activeEditDialog =
    editDialog &&
    !Object.is(editDialog.scope, closedDialogScopeRef.current) &&
    Object.is(editDialog.scope, scope)
      ? editDialog.dialog
      : null

  return {
    actions: {
      editMap: (ctx) => {
        const item = ctx.item
        if (item && isMapItem(item)) {
          openEditDialog({ kind: 'map', itemId: item.id })
        }
      },
      editFile: (ctx) => {
        const item = ctx.item
        if (item && isFileItem(item)) {
          openEditDialog({ kind: 'file', itemId: item.id })
        }
      },
      editItem: (ctx) => {
        if (ctx.item) {
          openEditDialog({ kind: 'item', item: ctx.item })
        }
      },
    },
    dialogs: renderRuntimeItemEditDialog(activeEditDialog, source, closeEditDialog),
  }
}

function renderRuntimeItemEditDialog(
  editDialog: RuntimeItemEditDialogState | null,
  source: RuntimeItemEditDialogsInput,
  onClose: () => void,
): ReactNode {
  if (!editDialog) return null

  if (editDialog.kind === 'map') {
    return createElement(RuntimeMapEditDialog, {
      key: `edit-map-${editDialog.itemId}`,
      mapId: editDialog.itemId,
      onClose,
      runtime: source.mapDialogRuntime,
    })
  }

  if (editDialog.kind === 'file') {
    return createElement(RuntimeFileEditDialog, {
      key: `edit-file-${editDialog.itemId}`,
      fileId: editDialog.itemId,
      onClose,
      runtime: source.fileDialogRuntime,
    })
  }

  return createElement(SidebarItemEditDialog, {
    key: `edit-sidebar-item-${editDialog.item.id}`,
    item: editDialog.item,
    isOpen: true,
    onClose,
    editItem: source.editItem,
  })
}

interface RuntimeMapPinContextMenu {
  actions: WorkspaceMapPinContextMenuServices['actions']['mapPins']
  service: WorkspaceMapPinContextMenuServices['mapPins']
}

function useRuntimeMapPinContextMenu(runtime: {
  navigation: Pick<WorkspaceNavigation, 'openItem'>
}): RuntimeMapPinContextMenu | null {
  const mapPinState = useMapPinMenuServiceState()
  if (!mapPinState) return null

  const mapPins = createMapPinMenuService(mapPinState)
  return {
    actions: createMapPinActions({
      mapPins,
      openItem: async (itemId, navigationOptions) => {
        await runtime.navigation.openItem(createWorkspaceResource(itemId), navigationOptions)
      },
    }),
    service: mapPins,
  }
}

function useRuntimeBlockShareService(
  blockSharing: BlocksShareSource,
  noteMenuContext: ReturnType<typeof useNoteWorkspaceMenuContextFields>,
) {
  const blockShareTargets = getNoteBlockShareTargetsFromFields(noteMenuContext)
  const blockShareCapability = useBlocksShare(
    blockSharing,
    blockShareTargets.blocks,
    blockShareTargets.note,
  )
  const blockShareTargetKey =
    blockShareCapability.status === 'available' && blockShareCapability.state.status === 'ready'
      ? getBlockShareTargetKey(blockShareTargets, blockShareCapability.state.defaultPermissionLevel)
      : 'unsupported'
  const [optimisticBlockSharePermission, setOptimisticBlockSharePermission] =
    useState<OptimisticBlockSharePermission | null>(null)

  if (
    blockShareCapability.status !== 'available' ||
    blockShareCapability.state.status !== 'ready'
  ) {
    return {
      canOpen: () => false,
      canToggleAllPlayersPermission: () => false,
      getAllPlayersPermissionLevel: () => 'hidden' as const,
      toggleAllPlayersPermission: () => undefined,
    }
  }

  const blockShare = blockShareCapability.state
  const displayedAllPlayersPermissionLevel =
    optimisticBlockSharePermission?.targetKey === blockShareTargetKey
      ? optimisticBlockSharePermission.permissionLevel
      : blockShare.defaultPermissionLevel
  const optimisticBlockShareIsPending =
    optimisticBlockSharePermission?.targetKey === blockShareTargetKey
  const canToggleBlockShare = !blockShare.isMutating && !optimisticBlockShareIsPending

  return {
    canOpen: (context: WorkspaceMenuContext) => getContextMenuBlockShareTargets(context).length > 0,
    canToggleAllPlayersPermission: () => canToggleBlockShare,
    getAllPlayersPermissionLevel: () => displayedAllPlayersPermissionLevel,
    toggleAllPlayersPermission: () => {
      if (!canToggleBlockShare) return
      const nextPermission = displayedAllPlayersPermissionLevel === 'visible' ? 'hidden' : 'visible'
      setOptimisticBlockSharePermission({
        targetKey: blockShareTargetKey,
        permissionLevel: nextPermission,
      })
      void blockShare
        .setDefaultPermission(nextPermission)
        .then((result) => {
          if (result.status !== 'completed') {
            reportShareActionFailure(result, 'Failed to update block sharing')
          }
        })
        .catch((error) => handleError(error, 'Failed to update block sharing'))
        .finally(() => {
          setOptimisticBlockSharePermission(null)
        })
    },
  }
}

function getBlockShareTargetKey({ blocks, note }: NoteBlockShareTargets, permissionLevel: string) {
  return `${note?.id ?? 'no-note'}:${blocks.map((block) => block.id).join(',')}:${permissionLevel}`
}

function getContextMenuBlockShareTargets(context: WorkspaceMenuContext) {
  return getNoteBlockShareTargetsFromMenuContext(context).blocks
}
