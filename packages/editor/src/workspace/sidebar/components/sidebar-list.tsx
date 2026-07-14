import type { ResourceId } from '../../../resources/domain-id'
import { SidebarItem } from './sidebar-item/sidebar-item'
import { useSidebarWorkspaceState } from '../workspace-state'

import type { SidebarTreeSource } from './sidebar-tree-source'
import { SidebarSurfaceScrollArea } from './sidebar-surface-scroll-area'

export function SidebarList({ source }: { source: SidebarTreeSource }) {
  const {
    ui: { closeAllFoldersMode, folderStates },
    sort: { options: sortOptions },
  } = useSidebarWorkspaceState()
  const isActive = source.activeStatus === 'success'

  const rootItems = isActive ? source.getVisibleRoots({ sortOptions }) : []
  const getChildren = (parentId: ResourceId) =>
    isActive ? source.getVisibleChildren({ parentId, sortOptions }) : []
  const expandedFolderIds = new Set<ResourceId>()
  if (!closeAllFoldersMode) {
    for (const [id, isOpen] of Object.entries(folderStates)) {
      if (isOpen) expandedFolderIds.add(id as ResourceId)
    }
  }
  const visibleItemIds = isActive
    ? source.getVisibleItemIds({
        expandedFolderIds,
        sortOptions,
      })
    : []
  if (!isActive) {
    return null
  }

  return (
    <SidebarSurfaceScrollArea
      className="p-1"
      surface="sidebar"
      parentId={null}
      visibleItemIds={visibleItemIds}
    >
      {rootItems.map((item) => (
        <SidebarItem
          key={item.id}
          getChildren={getChildren}
          item={item}
          source={source.item}
          visibleItemIds={visibleItemIds}
        />
      ))}
    </SidebarSurfaceScrollArea>
  )
}
