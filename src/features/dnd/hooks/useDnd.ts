import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarDropData } from '~/features/dnd/utils/dnd-registry'

export interface DndValue {
  resolveItem: (id: Id<'sidebarItems'>) => AnySidebarItem | null
  resolveDropTarget: (rawData: Record<string, unknown>) => SidebarDropData | null
}

export const DndProviderContext = createContext<DndValue | null>(null)

export function useDnd(): DndValue {
  const ctx = useContext(DndProviderContext)
  if (!ctx) throw new Error('useDnd must be used within DndProvider')
  return ctx
}

DndProviderContext.displayName = 'DndProviderContext'
