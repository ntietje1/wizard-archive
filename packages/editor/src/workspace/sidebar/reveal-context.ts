import { createContext } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'

export type WorkspaceSidebarReveal = (itemId: SidebarItemId) => void

export const WorkspaceSidebarRevealContext = createContext<WorkspaceSidebarReveal | null>(null)
