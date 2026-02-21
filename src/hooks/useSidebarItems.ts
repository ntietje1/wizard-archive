import { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { effectiveHasAtLeastPermission } from '~/lib/permission-utils'
import { isFolder } from '~/lib/sidebar-item-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'

export interface AllSidebarItemsValue {
  data: Array<AnySidebarItem>
  status: UseQueryResult['status']
  itemsMap: Map<SidebarItemId, AnySidebarItem>
  parentItemsMap: Map<Id<'folders'> | undefined, Array<AnySidebarItem>>
  getAncestorSidebarItems: (itemId: SidebarItemId) => Array<Folder>
}

export const AllSidebarItemsContext =
  createContext<AllSidebarItemsValue | null>(null)

/**
 * Provider hook — call ONCE at the provider level to create the query + derived data.
 * Renders a single React Query observer for `getAllSidebarItems`.
 */
export const useSidebarItemsQuery = (): AllSidebarItemsValue => {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const query = useQuery({
    ...convexQuery(
      api.sidebarItems.queries.getAllSidebarItems,
      campaignId ? { campaignId } : 'skip',
    ),
  })

  const data: Array<AnySidebarItem> = useMemo(
    () => query.data ?? [],
    [query.data],
  )

  const sidebarItemIdMap = useMemo(() => {
    const map = new Map<SidebarItemId, AnySidebarItem>()
    data.forEach((item) => {
      map.set(item._id, item)
    })
    return map
  }, [data])

  const sidebarItemParentIdMap = useMemo(() => {
    const map = new Map<Id<'folders'> | undefined, Array<AnySidebarItem>>()
    data.forEach((item) => {
      // If the item's parent folder isn't in our permitted set, show at root
      const effectiveParentId =
        item.parentId && !sidebarItemIdMap.has(item.parentId)
          ? undefined
          : item.parentId
      if (map.has(effectiveParentId)) {
        map.get(effectiveParentId)?.push(item)
      } else {
        map.set(effectiveParentId, [item])
      }
    })
    return map
  }, [data, sidebarItemIdMap])

  const getAncestorSidebarItems = useCallback(
    (itemId: SidebarItemId) => {
      const item = sidebarItemIdMap.get(itemId)
      if (!item) return []
      let currAncestorId = item.parentId
      const seen = new Set<Id<'folders'>>()
      const ancestorItems: Array<Folder> = []
      while (currAncestorId && !seen.has(currAncestorId)) {
        seen.add(currAncestorId)
        const currAncestor = sidebarItemIdMap.get(currAncestorId)
        if (currAncestor && isFolder(currAncestor)) {
          ancestorItems.push(currAncestor)
          currAncestorId = currAncestor.parentId
        }
      }
      return ancestorItems
    },
    [sidebarItemIdMap],
  )

  return {
    data,
    status: query.status,
    itemsMap: sidebarItemIdMap,
    parentItemsMap: sidebarItemParentIdMap,
    getAncestorSidebarItems,
  }
}

/**
 * Consumer hook — reads from context. Many components can call this
 * without creating additional React Query observers.
 */
export const useAllSidebarItems = (): AllSidebarItemsValue => {
  const ctx = useContext(AllSidebarItemsContext)
  if (!ctx) {
    throw new Error(
      'useAllSidebarItems must be used within an AllSidebarItemsProvider',
    )
  }
  return ctx
}

export const sortItemsByOptions = (
  options: SortOptions,
  items?: Array<AnySidebarItem>,
) => {
  if (!items) return undefined

  const sortFn = (a: AnySidebarItem, b: AnySidebarItem) => {
    switch (options.order) {
      case SORT_ORDERS.Alphabetical: {
        const nameA = a.name || ''
        const nameB = b.name || ''
        return options.direction === SORT_DIRECTIONS.Ascending
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA)
      }
      case SORT_ORDERS.DateCreated:
        return options.direction === SORT_DIRECTIONS.Ascending
          ? a._creationTime - b._creationTime
          : b._creationTime - a._creationTime
      case SORT_ORDERS.DateModified:
        return options.direction === SORT_DIRECTIONS.Ascending
          ? a.updatedAt - b.updatedAt
          : b.updatedAt - a.updatedAt
      default:
        return 0
    }
  }

  return [...items].sort(sortFn)
}

/**
 * Returns sidebar items filtered to only those the user can VIEW.
 * Each item's `myPermissionLevel` is set by the backend, so we just filter on it.
 */
export const useFilteredSidebarItems = () => {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const allItems = useAllSidebarItems()

  const filteredData = useMemo(() => {
    const permOpts = { isDm, viewAsPlayerId, allItemsMap: allItems.itemsMap }
    return allItems.data.filter((item) =>
      effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
    )
  }, [allItems.data, allItems.itemsMap, isDm, viewAsPlayerId])

  const filteredItemsMap = useMemo(() => {
    const map = new Map<SidebarItemId, AnySidebarItem>()
    filteredData.forEach((item) => map.set(item._id, item))
    return map
  }, [filteredData])

  const filteredParentItemsMap = useMemo(() => {
    const map = new Map<Id<'folders'> | undefined, Array<AnySidebarItem>>()
    filteredData.forEach((item) => {
      const effectiveParentId =
        item.parentId && !filteredItemsMap.has(item.parentId)
          ? undefined
          : item.parentId
      if (map.has(effectiveParentId)) {
        map.get(effectiveParentId)?.push(item)
      } else {
        map.set(effectiveParentId, [item])
      }
    })
    return map
  }, [filteredData, filteredItemsMap])

  const getAncestorSidebarItems = useCallback(
    (itemId: SidebarItemId) => {
      const item = filteredItemsMap.get(itemId)
      if (!item) return []
      let currAncestorId = item.parentId
      const seen = new Set<Id<'folders'>>()
      const ancestorItems: Array<Folder> = []
      while (currAncestorId && !seen.has(currAncestorId)) {
        seen.add(currAncestorId)
        const currAncestor = filteredItemsMap.get(currAncestorId)
        if (currAncestor && isFolder(currAncestor)) {
          ancestorItems.push(currAncestor)
          currAncestorId = currAncestor.parentId
        }
      }
      return ancestorItems
    },
    [filteredItemsMap],
  )

  return {
    data: filteredData,
    status: allItems.status,
    itemsMap: filteredItemsMap,
    parentItemsMap: filteredParentItemsMap,
    getAncestorSidebarItems,
  }
}
