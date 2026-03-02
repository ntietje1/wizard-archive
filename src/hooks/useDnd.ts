import { createContext, useContext } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarDropData } from '~/lib/dnd-registry'

export interface DndValue {
  resolveItem: (id: SidebarItemId) => AnySidebarItem | null
  resolveDropTarget: (
    rawData: Record<string, unknown>,
  ) => SidebarDropData | null
}

export const DndProviderContext = createContext<DndValue | null>(null)

export function useDnd(): DndValue {
  const ctx = useContext(DndProviderContext)
  if (!ctx) throw new Error('useDnd must be used within DndProvider')
  return ctx
}

DndProviderContext.displayName = 'DndProviderContext'
