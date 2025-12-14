import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { SidebarItemButton } from './sidebar-item-button'

interface SidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: SidebarItemId[]
}

export const SidebarItem = ({ item, ancestorIds = [] }: SidebarItemProps) => {
  return <SidebarItemButton item={item} ancestorIds={ancestorIds} />
}
