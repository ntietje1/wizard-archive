import { useUserPreferences } from '~/features/settings/hooks/useUserPreferences'
import { SidebarLayoutContext } from '~/features/sidebar/hooks/useSidebarLayout'

export function SidebarLayoutProvider({
  children,
  initialSidebarWidth,
  initialSidebarExpanded,
}: {
  children: React.ReactNode
  initialSidebarWidth?: number
  initialSidebarExpanded?: boolean
}) {
  const {
    isSidebarExpanded,
    setIsSidebarExpanded,
    sidebarWidth,
    setSidebarWidth,
    isLoaded: isUserPreferencesLoaded,
  } = useUserPreferences({
    sidebarWidth: initialSidebarWidth,
    isSidebarExpanded: initialSidebarExpanded,
  })

  const value = {
    isSidebarExpanded,
    setIsSidebarExpanded,
    sidebarWidth,
    setSidebarWidth,
    isUserPreferencesLoaded,
  }

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  )
}
