import { createContext, useContext } from 'react'

export type SidebarLayoutContextType = {
  isSidebarExpanded: boolean
  setIsSidebarExpanded: (isExpanded: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isUserPreferencesLoaded: boolean
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
