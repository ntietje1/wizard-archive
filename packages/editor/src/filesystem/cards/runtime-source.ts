import { getWorkspaceNavigationCurrentResourceId } from '../../workspace/runtime'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { CREATE_PARENT_TARGET_KIND } from '../../workspace/items'
import { createSidebarDragDataSource } from '../../drag-drop/sidebar-drag-data'
import type { FolderViewerSource, ItemCardSource, FolderViewerStatus } from './source'
import type { WorkspaceNavigation } from '../../workspace/runtime'
import type { ResourceCatalog, ResourceOperationItems } from '../catalog'
import type { FileSystemItemCreateOperations } from '../item-operation-contracts'
import type { FileSystemLoadState } from '../load-state'
import type { FileSystemPermissions } from '../permissions'

export type RuntimeItemCardSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'current' | 'openItem'>
  filesystem: {
    catalog: Pick<ResourceCatalog, 'getKnownItemById'>
    operationItems: ResourceOperationItems
    permissions: Pick<FileSystemPermissions, 'canMutateItem'>
  }
}

export type RuntimeFolderViewerSourceInput = RuntimeItemCardSourceInput & {
  filesystem: RuntimeItemCardSourceInput['filesystem'] & {
    catalog: RuntimeItemCardSourceInput['filesystem']['catalog'] &
      Pick<ResourceCatalog, 'getTrashedChildren' | 'getVisibleChildren'>
    load: Pick<FileSystemLoadState, 'activeStatus' | 'trashStatus'>
    operations: FileSystemItemCreateOperations
    permissions: RuntimeItemCardSourceInput['filesystem']['permissions'] &
      Pick<FileSystemPermissions, 'canCreateItems'>
  }
}

export function createRuntimeItemCardSource(runtime: RuntimeItemCardSourceInput): ItemCardSource {
  const {
    filesystem: { catalog, operationItems, permissions },
    navigation,
  } = runtime
  const dragDataSource = createSidebarDragDataSource({ catalog, operationItems })
  return {
    canDragItem: (item) => permissions.canMutateItem(item, PERMISSION_LEVEL.FULL_ACCESS),
    currentItemId: getWorkspaceNavigationCurrentResourceId(navigation),
    getSidebarDragData: dragDataSource.getSidebarDragData,
    openItem: (itemId) => navigation.openItem(itemId),
  }
}

export function createRuntimeFolderViewerSource(
  runtime: RuntimeFolderViewerSourceInput,
): FolderViewerSource {
  const {
    filesystem: { catalog, load, operations, permissions },
  } = runtime
  return {
    ...createRuntimeItemCardSource(runtime),
    canCreateInFolder: (folder) =>
      !folder.isTrashed &&
      permissions.canCreateItems &&
      permissions.canMutateItem(folder, PERMISSION_LEVEL.FULL_ACCESS),
    canDropIntoFolder: (folder) =>
      !folder.isTrashed && permissions.canMutateItem(folder, PERMISSION_LEVEL.FULL_ACCESS),
    createItemInFolder: ({ name, parentId, type }) =>
      operations.createItem({
        name,
        type,
        parentTarget: { kind: CREATE_PARENT_TARGET_KIND.direct, parentId },
      }),
    getChildren: (folder) =>
      folder.isTrashed
        ? catalog.getTrashedChildren(folder.id)
        : catalog.getVisibleChildren(folder.id),
    getStatus: (folder): FolderViewerStatus =>
      folder.isTrashed ? load.trashStatus : load.activeStatus,
  }
}
