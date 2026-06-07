import type { SidebarItemsContextValue, SidebarItemsValue } from '../contexts/sidebar-items-context'

export interface SidebarWorkspaceSource {
  items: SidebarItemsContextValue
  filteredActiveItems: SidebarItemsValue
}
