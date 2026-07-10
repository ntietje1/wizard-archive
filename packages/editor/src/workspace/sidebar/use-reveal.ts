import { use } from 'react'
import { WorkspaceSidebarRevealContext } from './reveal-context'
import type { WorkspaceSidebarReveal } from './reveal-context'

export function useWorkspaceSidebarReveal(): WorkspaceSidebarReveal {
  const showItemInSidebar = use(WorkspaceSidebarRevealContext)
  if (!showItemInSidebar) {
    throw new Error('useWorkspaceSidebarReveal must be used within WorkspaceSidebarRevealProvider')
  }
  return showItemInSidebar
}
