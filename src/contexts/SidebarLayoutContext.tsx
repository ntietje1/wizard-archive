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
    isLoaded: isEditorSettingsLoaded,
  } = useUserPreferences()

  const value = useMemo(
    () => ({
      isSidebarExpanded,
      setIsSidebarExpanded,
      sidebarWidth,
      setSidebarWidth,
      isEditorSettingsLoaded,
    }),
    [
      isSidebarExpanded,
      setIsSidebarExpanded,
      sidebarWidth,
      setSidebarWidth,
      isEditorSettingsLoaded,
    ],
  )

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  )
}
