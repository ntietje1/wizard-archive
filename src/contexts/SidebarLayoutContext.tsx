import { useMemo } from 'react'
import { useEditorSettings } from '~/hooks/useSidebarWidth'
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
  } = useEditorSettings()

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
