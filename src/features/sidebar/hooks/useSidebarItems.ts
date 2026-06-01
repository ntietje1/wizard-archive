import { createContext, useContext } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'shared/editor/types'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SortOptions } from 'shared/editor/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { assertNever } from '~/shared/utils/utils'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

// ---------------------------------------------------------------------------
// Shared value shape
// ---------------------------------------------------------------------------

export interface SidebarItemsValue extends SidebarItemMaps {
  data: Array<AnySidebarItem>
  status: UseQueryResult['status']
}

// ---------------------------------------------------------------------------
// Context — all locations, eagerly loaded
// ---------------------------------------------------------------------------

export const SIDEBAR_ITEMS_VIEW = {
  active: 'active',
  trash: 'trash',
} as const

export type SidebarItemsView = (typeof SIDEBAR_ITEMS_VIEW)[keyof typeof SIDEBAR_ITEMS_VIEW]

type SidebarItemsContextValue = Record<SidebarItemsView, SidebarItemsValue>

export const SidebarItemsContext = createContext<SidebarItemsContextValue | null>(null)

function useSidebarItemQuery(view: SidebarItemsView): SidebarItemsValue {
  const { campaignId } = useCampaign()
  const query = (() => {
    switch (view) {
      case SIDEBAR_ITEMS_VIEW.active:
        return api.sidebarItems.queries.getActiveSidebarItems
      case SIDEBAR_ITEMS_VIEW.trash:
        return api.sidebarItems.queries.getTrashedSidebarItems
      default:
        return assertNever(view)
    }
  })()

  const result = useAuthQuery(query, campaignId ? { campaignId } : 'skip', {
    placeholderData: keepPreviousData,
  })

  const data: Array<AnySidebarItem> = result.data ?? []

  return {
    data,
    status: result.status,
    ...buildSidebarItemMaps(data),
  }
}

export const useSidebarItemsQueries = (): SidebarItemsContextValue => {
  const active = useSidebarItemQuery(SIDEBAR_ITEMS_VIEW.active)
  const trash = useSidebarItemQuery(SIDEBAR_ITEMS_VIEW.trash)
  return { active, trash }
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

export const useSidebarItems = (view: SidebarItemsView): SidebarItemsValue => {
  const ctx = useContext(SidebarItemsContext)
  if (!ctx) {
    throw new Error('useSidebarItems must be used within a SidebarItemsProvider')
  }
  return ctx[view]
}

export const useActiveSidebarItems = (): SidebarItemsValue =>
  useSidebarItems(SIDEBAR_ITEMS_VIEW.active)

export const useTrashSidebarItems = (): SidebarItemsValue =>
  useSidebarItems(SIDEBAR_ITEMS_VIEW.trash)

export const useOptionalActiveSidebarItems = (): SidebarItemsValue | null => {
  const ctx = useContext(SidebarItemsContext)
  return ctx?.active ?? null
}

// ---------------------------------------------------------------------------
// Sorting utility
// ---------------------------------------------------------------------------

export const sortItemsByOptions = (options: SortOptions, items?: Array<AnySidebarItem>) => {
  if (!items) return undefined

  const sortFn = (a: AnySidebarItem, b: AnySidebarItem) => {
    switch (options.order) {
      case SORT_ORDERS.Alphabetical: {
        const nameA = a.name
        const nameB = b.name
        return options.direction === SORT_DIRECTIONS.Ascending
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA)
      }
      case SORT_ORDERS.DateCreated:
        return options.direction === SORT_DIRECTIONS.Ascending
          ? a._creationTime - b._creationTime
          : b._creationTime - a._creationTime
      case SORT_ORDERS.DateModified: {
        const aTime = a.updatedTime ?? a._creationTime
        const bTime = b.updatedTime ?? b._creationTime
        return options.direction === SORT_DIRECTIONS.Ascending ? aTime - bTime : bTime - aTime
      }
      default:
        return assertNever(options.order)
    }
  }

  return [...items].sort(sortFn)
}
