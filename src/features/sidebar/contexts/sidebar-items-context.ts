import { createContext, useContext } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { SidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

export interface SidebarItemsValue extends SidebarItemMaps {
  data: Array<AnySidebarItem>
  status: UseQueryResult['status']
  error: UseQueryResult['error']
  refetch: UseQueryResult['refetch']
}

export const SIDEBAR_ITEMS_VIEW = {
  active: 'active',
  trash: 'trash',
} as const

export type SidebarItemsView = (typeof SIDEBAR_ITEMS_VIEW)[keyof typeof SIDEBAR_ITEMS_VIEW]
export type SidebarItemsContextValue = Record<SidebarItemsView, SidebarItemsValue>

export const SidebarItemsContext = createContext<SidebarItemsContextValue | null>(null)

export const useOptionalActiveSidebarItems = (): SidebarItemsValue | null => {
  const ctx = useContext(SidebarItemsContext)
  return ctx?.active ?? null
}
