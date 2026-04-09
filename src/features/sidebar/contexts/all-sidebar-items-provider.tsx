import {
  SidebarItemsContext,
  useSidebarItemsQueries,
} from '~/features/sidebar/hooks/useSidebarItems'

export function SidebarItemsProvider({ children }: { children: React.ReactNode }) {
  const value = useSidebarItemsQueries()

  return <SidebarItemsContext.Provider value={value}>{children}</SidebarItemsContext.Provider>
}
