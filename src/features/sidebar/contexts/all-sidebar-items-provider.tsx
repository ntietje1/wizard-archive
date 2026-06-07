import { SidebarItemsContext } from '~/features/sidebar/contexts/sidebar-items-context'
import { FilteredSidebarItemsProvider } from '~/features/sidebar/contexts/filtered-sidebar-items-provider'
import { useLiveSidebarWorkspaceSource } from '~/features/sidebar/workspace/use-live-sidebar-workspace-source'

export function SidebarItemsProvider({ children }: { children: React.ReactNode }) {
  const source = useLiveSidebarWorkspaceSource()

  return (
    <SidebarItemsContext.Provider value={source.items}>
      <FilteredSidebarItemsProvider value={source.filteredActiveItems}>
        {children}
      </FilteredSidebarItemsProvider>
    </SidebarItemsContext.Provider>
  )
}
