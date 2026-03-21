import { useMemo } from 'react'
import { useUserPreferences } from '~/hooks/useUserPreferences'
import { SidebarLayoutContext } from '~/hooks/useSidebarLayout'

export function SidebarLayoutProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    isSidebarExpanded,
    setIsSidebarExpanded,
    sidebarWidth,
    setSidebarWidth,
    isLoaded: isUserPreferencesLoaded,
  } = useUserPreferences()

  const value = useMemo(
    () => ({
      isSidebarExpanded,
      setIsSidebarExpanded,
      sidebarWidth,
      setSidebarWidth,
      isUserPreferencesLoaded,
    }),
    [
      isSidebarExpanded,
      setIsSidebarExpanded,
      sidebarWidth,
      setSidebarWidth,
      isUserPreferencesLoaded,
    ],
  )

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  )
}
