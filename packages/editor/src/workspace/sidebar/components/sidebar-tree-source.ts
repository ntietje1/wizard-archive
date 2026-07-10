import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { AnyItem, FolderItem } from '../../items'
import type { WorkspaceNavigation } from '../../runtime'
import type { SortOptions } from '../../items-persistence-contract'
import type { SidebarDragDataSource } from '../../../drag-drop/sidebar-drag-data'
import type { SidebarShareButtonSource } from '../sidebar-share-button-source'

interface SidebarItemEditInput {
  color?: string | null
  iconName?: string | null
  item: AnyItem
  name?: string
}

export interface SidebarItemSource extends SidebarDragDataSource {
  canDragItem: (item: AnyItem) => boolean
  canDropOnFolder: (folder: FolderItem) => boolean
  canUseItemActions: (item: AnyItem) => boolean
  currentItemId: SidebarItemId | null
  editItem: (input: SidebarItemEditInput) => Promise<unknown>
  openItem: WorkspaceNavigation['openItem']
  shareButtonSource?: SidebarShareButtonSource
}

export interface SidebarTreeSource {
  activeError: unknown
  activeStatus: 'pending' | 'error' | 'success'
  canDropOnRoot: boolean
  getVisibleChildren: (input: {
    parentId: SidebarItemId
    sortOptions: SortOptions
  }) => ReadonlyArray<AnyItem>
  getVisibleRoots: (input: { sortOptions: SortOptions }) => ReadonlyArray<AnyItem>
  getBookmarkedItems: (input: { sortOptions: SortOptions }) => ReadonlyArray<AnyItem>
  getVisibleItemIds: (input: {
    expandedFolderIds: ReadonlySet<SidebarItemId>
    sortOptions: SortOptions
  }) => ReadonlyArray<SidebarItemId>
  item: SidebarItemSource
  refreshActive: () => unknown
}
