import {
  SidebarItemsContext,
  useSidebarItemsQueries,
} from '~/features/sidebar/hooks/useSidebarItems'
import { FilteredSidebarItemsProvider } from '~/features/sidebar/hooks/useFilteredSidebarItems'

export function SidebarItemsProvider({ children }: { children: React.ReactNode }) {
  const value = useSidebarItemsQueries()

  return (
    <SidebarItemsContext.Provider value={value}>
      <FilteredSidebarItemsProvider>{children}</FilteredSidebarItemsProvider>
    </SidebarItemsContext.Provider>
  )
}
