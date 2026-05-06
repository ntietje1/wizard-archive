import { createContext, useContext } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SortOptions } from 'convex/editors/types'
import type { SidebarItemLocation } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
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

type SidebarItemsContextValue = Record<SidebarItemLocation, SidebarItemsValue>

export const SidebarItemsContext = createContext<SidebarItemsContextValue | null>(null)

function useSidebarItemQuery(location: SidebarItemLocation): SidebarItemsValue {
  const { campaignId } = useCampaign()

  const result = useAuthQuery(
    api.sidebarItems.queries.getSidebarItemsByLocation,
    campaignId ? { campaignId, location } : 'skip',
    { placeholderData: keepPreviousData },
  )

  const data: Array<AnySidebarItem> = result.data ?? []

  return {
    data,
    status: result.status,
    ...buildSidebarItemMaps(data),
  }
}

export const useSidebarItemsQueries = (): SidebarItemsContextValue => {
  const sidebar = useSidebarItemQuery(SIDEBAR_ITEM_LOCATION.sidebar)
  const trash = useSidebarItemQuery(SIDEBAR_ITEM_LOCATION.trash)
  return { sidebar, trash }
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

export const useSidebarItems = (location: SidebarItemLocation): SidebarItemsValue => {
  const ctx = useContext(SidebarItemsContext)
  if (!ctx) {
    throw new Error('useSidebarItems must be used within a SidebarItemsProvider')
  }
  return ctx[location]
}

export const useActiveSidebarItems = (): SidebarItemsValue =>
  useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)

export const useOptionalActiveSidebarItems = (): SidebarItemsValue | null => {
  const ctx = useContext(SidebarItemsContext)
  return ctx?.[SIDEBAR_ITEM_LOCATION.sidebar] ?? null
}

// ---------------------------------------------------------------------------
// Filtered (permission-gated) view of active items
// ---------------------------------------------------------------------------

export const useFilteredSidebarItems = (): SidebarItemsValue => {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const allItems = useActiveSidebarItems()

  const permOpts = { isDm, viewAsPlayerId, allItemsMap: allItems.itemsMap }
  const filteredData = allItems.data.filter((item) =>
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )

  return {
    data: filteredData,
    status: allItems.status,
    ...buildSidebarItemMaps(filteredData),
  }
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
