import { SidebarItemButton } from './sidebar-item-button'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'

interface SidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
}

export const SidebarItem = ({ item, ancestorIds = [] }: SidebarItemProps) => {
  return <SidebarItemButton item={item} ancestorIds={ancestorIds} />
}
