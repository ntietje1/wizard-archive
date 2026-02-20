import {
  AllSidebarItemsContext,
  useSidebarItemsQuery,
} from '~/hooks/useSidebarItems'

export function AllSidebarItemsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useSidebarItemsQuery()

  return (
    <AllSidebarItemsContext.Provider value={value}>
      {children}
    </AllSidebarItemsContext.Provider>
  )
}
