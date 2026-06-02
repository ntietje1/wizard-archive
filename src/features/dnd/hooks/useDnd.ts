import { createContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { SidebarDropData } from '~/features/dnd/utils/drop-target-data'

export interface DndValue {
  resolveItem: (id: Id<'sidebarItems'>) => AnySidebarItem | null
  resolveDropTarget: (rawData: Record<string, unknown>) => SidebarDropData | null
}

export const DndProviderContext = createContext<DndValue | null>(null)

DndProviderContext.displayName = 'DndProviderContext'
