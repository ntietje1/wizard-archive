import { createContext, useContext, useMemo } from 'react'
import { useEditorSettings } from '~/hooks/useSidebarWidth'

export type SidebarLayoutContextType = {
  isSidebarExpanded: boolean
  setIsSidebarExpanded: (isExpanded: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isEditorSettingsLoaded: boolean
}

export const SidebarLayoutContext =
  createContext<SidebarLayoutContextType | null>(null)

export const useSidebarLayout = (): SidebarLayoutContextType => {
  const context = useContext(SidebarLayoutContext)
  if (!context) {
    throw new Error(
      'useSidebarLayout must be used within a SidebarLayoutProvider',
    )
  }
  return context
}

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
