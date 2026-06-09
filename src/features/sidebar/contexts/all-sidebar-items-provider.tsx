import { SidebarItemsContext } from '~/features/sidebar/contexts/sidebar-items-context'
import { SidebarItemsPassthroughProvider } from '~/features/sidebar/contexts/filtered-sidebar-items-provider'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { useLiveSidebarWorkspaceSource } from '~/features/sidebar/workspace/use-live-sidebar-workspace-source'

export function SidebarItemsProvider({ children }: { children: React.ReactNode }) {
  const source = useLiveSidebarWorkspaceSource()

  return (
    <SidebarWorkspaceSourceProvider value={source}>
      <SidebarItemsContext.Provider value={source.items}>
        <SidebarItemsPassthroughProvider value={source.filteredActiveItems}>
          {children}
        </SidebarItemsPassthroughProvider>
      </SidebarItemsContext.Provider>
    </SidebarWorkspaceSourceProvider>
  )
}
