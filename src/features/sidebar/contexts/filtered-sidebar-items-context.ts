import { createContext } from 'react'
import type { SidebarItemsValue } from '~/features/sidebar/hooks/useSidebarItems'

export const FilteredSidebarItemsContext = createContext<SidebarItemsValue | null>(null)
