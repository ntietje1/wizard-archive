import type { ReactNode } from 'react'
import type { WorkspaceSidebarReveal } from './reveal-context'
import { WorkspaceSidebarRevealContext } from './reveal-context'

export function WorkspaceSidebarRevealProvider({
  children,
  showItemInSidebar,
}: {
  children: ReactNode
  showItemInSidebar: WorkspaceSidebarReveal
}) {
  return (
    <WorkspaceSidebarRevealContext.Provider value={showItemInSidebar}>
      {children}
    </WorkspaceSidebarRevealContext.Provider>
  )
}
