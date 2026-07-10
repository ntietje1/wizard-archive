import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { createSidebarDragDataSource } from '../../drag-drop/sidebar-drag-data'
import { createEditFileSystemItem } from '../../filesystem/edit-item'
import type { SidebarTreeSource } from './components/sidebar-tree-source'
import { createSidebarShareButtonSource } from './sidebar-share-button-source'
import { buildVisibleSidebarItemIds } from './utils/item-selection-order'
import { sortItemsByOptions } from './utils/sidebar-item-sort'
import { getWorkspaceNavigationCurrentResourceId } from '../runtime'
import type { WorkspaceNavigation } from '../runtime'
import type { ResourceCatalog, ResourceOperationItems } from '../../filesystem/catalog'
import type { FileSystemItemSidebarOperations } from '../../filesystem/item-operation-contracts'
import type { ResourceShareSource } from '../../sharing/contracts'
import type { FileSystemLoadState } from '../../filesystem/load-state'
import type { FileSystemPermissions } from '../../filesystem/permissions'
import type { SidebarWorkspaceState } from './workspace-state'

type RuntimeSidebarTreeSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'current' | 'openItem'>
  filesystem: {
    catalog: Pick<
      ResourceCatalog,
      'getKnownItemById' | 'getVisibleChildren' | 'getVisibleItems' | 'getVisibleRoots'
    >
    load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus' | 'refreshActive'>
    operationItems: ResourceOperationItems
    operations: Pick<FileSystemItemSidebarOperations, 'updateItemMetadata'>
    permissions: Pick<
      FileSystemPermissions,
      'canAccessItem' | 'canCreateItems' | 'canEdit' | 'canMutateItem'
    >
    sharing: { items: ResourceShareSource }
  }
  sidebarSelection: Pick<SidebarWorkspaceState['selectionCommands'], 'getSelectionSnapshot'>
}

export function createRuntimeSidebarTreeSource(
  runtime: RuntimeSidebarTreeSourceInput,
): SidebarTreeSource {
  const {
    filesystem: { catalog, load, operationItems, permissions },
    navigation,
    sidebarSelection,
  } = runtime
  const editItem = createEditFileSystemItem({
    catalog,
    operations: runtime.filesystem.operations,
    permissions: { canMutateItem: permissions.canMutateItem },
  })
  const dragDataSource = createSidebarDragDataSource({ catalog, operationItems })
  const shareButtonSource = createSidebarShareButtonSource({
    operationItems,
    sharing: runtime.filesystem.sharing.items,
    sidebarSelection,
  })

  return {
    activeError: load.activeError,
    activeStatus: load.activeStatus,
    canDropOnRoot: permissions.canCreateItems,
    getVisibleChildren: ({ parentId, sortOptions }) =>
      sortItemsByOptions(sortOptions, catalog.getVisibleChildren(parentId)),
    getVisibleRoots: ({ sortOptions }) =>
      sortItemsByOptions(sortOptions, catalog.getVisibleRoots()),
    getBookmarkedItems: ({ sortOptions }) =>
      sortItemsByOptions(
        sortOptions,
        catalog.getVisibleItems().filter((item) => item.isBookmarked),
      ),
    getVisibleItemIds: ({ expandedFolderIds, sortOptions }) =>
      buildVisibleSidebarItemIds({
        expandedFolderIds,
        getChildren: catalog.getVisibleChildren,
        getRoots: catalog.getVisibleRoots,
        sortOptions,
      }),
    item: {
      canDragItem: (item) => permissions.canMutateItem(item, PERMISSION_LEVEL.FULL_ACCESS),
      canDropOnFolder: (folder) => permissions.canMutateItem(folder, PERMISSION_LEVEL.FULL_ACCESS),
      canUseItemActions: (item) => permissions.canAccessItem(item, PERMISSION_LEVEL.VIEW),
      currentItemId: getWorkspaceNavigationCurrentResourceId(navigation),
      editItem,
      getSidebarDragData: dragDataSource.getSidebarDragData,
      openItem: navigation.openItem,
      shareButtonSource,
    },
    refreshActive: load.refreshActive,
  }
}
