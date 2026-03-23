import {
  AllSidebarItemsContext,
  TrashedSidebarItemsContext,
  useSidebarItemsQuery,
  useTrashedSidebarItemsQuery,
} from '~/features/sidebar/hooks/useSidebarItems'

export function AllSidebarItemsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useSidebarItemsQuery()
  const trashedValue = useTrashedSidebarItemsQuery()

  return (
    <AllSidebarItemsContext.Provider value={value}>
      <TrashedSidebarItemsContext.Provider value={trashedValue}>
        {children}
      </TrashedSidebarItemsContext.Provider>
    </AllSidebarItemsContext.Provider>
  )
}
