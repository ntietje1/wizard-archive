import type { ResourceId } from '../../resources/domain-id'
import { createContext } from 'react'

export type WorkspaceSidebarReveal = (itemId: ResourceId) => void

export const WorkspaceSidebarRevealContext = createContext<WorkspaceSidebarReveal | null>(null)
