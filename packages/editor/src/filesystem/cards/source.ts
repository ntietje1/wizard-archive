import type { ResourceId } from '../../resources/domain-id'
import type { MaybePromise } from '../../../../../shared/common/async'

import type { AnyItem, FolderItem } from '../../workspace/items'
import type { ResourceKind } from '../../workspace/resource-contract'
import type { SidebarDragDataSource } from '../../drag-drop/sidebar-drag-data'
import type { FileSystemCreateItemResult } from '../item-operation-contracts'

export type FolderViewerStatus = 'pending' | 'error' | 'success'

export interface ItemCardSource extends SidebarDragDataSource {
  canDragItem: (item: AnyItem) => boolean
  currentItemId: ResourceId | null
  openItem: (itemId: ResourceId) => MaybePromise<unknown>
}

export interface FolderViewerSource extends ItemCardSource {
  canCreateInFolder: (folder: FolderItem) => boolean
  canDropIntoFolder: (folder: FolderItem) => boolean
  createItemInFolder: (input: {
    name?: string
    parentId: ResourceId
    type: ResourceKind
  }) => MaybePromise<FileSystemCreateItemResult>
  getChildren: (folder: FolderItem) => ReadonlyArray<AnyItem>
  getStatus: (folder: FolderItem) => FolderViewerStatus
}
