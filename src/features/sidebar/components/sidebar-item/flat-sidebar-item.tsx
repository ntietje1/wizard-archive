import { SidebarLiveItemButton } from './sidebar-live-item-button'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

interface FlatSidebarItemProps {
  item: AnySidebarItem
  renamingId: Id<'sidebarItems'> | null
  setRenamingId: (id: Id<'sidebarItems'> | null) => void
  visibleItemIds: Array<Id<'sidebarItems'>>
}

export function FlatSidebarItem({
  item,
  renamingId,
  setRenamingId,
  visibleItemIds,
}: FlatSidebarItemProps) {
  return (
    <SidebarLiveItemButton
      expanded={false}
      item={item}
      renamingId={renamingId}
      setRenamingId={setRenamingId}
      showChevron={false}
      surface="bookmarks"
      visibleItemIds={visibleItemIds}
    />
  )
}
