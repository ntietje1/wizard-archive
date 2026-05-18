import { useContext } from 'react'
import type { SidebarItemsValue } from './useSidebarItems'
import { FilteredSidebarItemsContext } from '~/features/sidebar/contexts/filtered-sidebar-items-context'

export const useFilteredSidebarItems = (): SidebarItemsValue => {
  const ctx = useContext(FilteredSidebarItemsContext)
  if (!ctx) {
    throw new Error('useFilteredSidebarItems must be used within a FilteredSidebarItemsProvider')
  }
  return ctx
}
