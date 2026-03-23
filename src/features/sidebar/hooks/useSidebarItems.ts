import { createContext, useCallback, useContext, useMemo } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { assertNever } from '~/shared/utils/utils'

export interface AllSidebarItemsValue {
  data: Array<AnySidebarItem>
  status: UseQueryResult['status']
  itemsMap: Map<SidebarItemId, AnySidebarItem>
  parentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>
  getAncestorSidebarItems: (itemId: SidebarItemId) => Array<Folder>
}

export const AllSidebarItemsContext =
  createContext<AllSidebarItemsValue | null>(null)

/**
 * Provider hook — call ONCE at the provider level to create the query + derived data.
 * Renders a single React Query observer for `getAllSidebarItems`.
 */
export const useSidebarItemsQuery = (): AllSidebarItemsValue => {
  const { campaignId } = useCampaign()

  const query = useAuthQuery(
    api.sidebarItems.queries.getAllSidebarItems,
    campaignId ? { campaignId } : 'skip',
    { placeholderData: keepPreviousData },
  )

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
    const map = new Map<Id<'folders'> | null, Array<AnySidebarItem>>()
    data.forEach((item) => {
      // If the item's parent folder isn't in our permitted set, show at root
      const effectiveParentId =
        item.parentId && !sidebarItemIdMap.has(item.parentId)
          ? null
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

// ---------------------------------------------------------------------------
// Trashed sidebar items (mirrors the active items pattern above)
// ---------------------------------------------------------------------------

export interface TrashedSidebarItemsValue {
  data: Array<AnySidebarItem>
  status: UseQueryResult['status']
  itemsMap: Map<SidebarItemId, AnySidebarItem>
  parentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>
}

export const TrashedSidebarItemsContext =
  createContext<TrashedSidebarItemsValue | null>(null)

/**
 * Provider hook — call ONCE at the provider level to create the query + derived data.
 * Renders a single React Query observer for `getTrashedSidebarItems`.
 */
export const useTrashedSidebarItemsQuery = (): TrashedSidebarItemsValue => {
  const { campaignId } = useCampaign()

  const query = useAuthQuery(
    api.sidebarItems.queries.getTrashedSidebarItems,
    campaignId ? { campaignId } : 'skip',
    { placeholderData: keepPreviousData },
  )

  const data: Array<AnySidebarItem> = useMemo(
    () => query.data ?? [],
    [query.data],
  )

  const itemsMap = useMemo(() => {
    const map = new Map<SidebarItemId, AnySidebarItem>()
    data.forEach((item) => map.set(item._id, item))
    return map
  }, [data])

  const parentItemsMap = useMemo(() => {
    const map = new Map<Id<'folders'> | null, Array<AnySidebarItem>>()
    data.forEach((item) => {
      const effectiveParentId =
        item.parentId && !itemsMap.has(item.parentId) ? null : item.parentId
      if (map.has(effectiveParentId)) {
        map.get(effectiveParentId)?.push(item)
      } else {
        map.set(effectiveParentId, [item])
      }
    })
    return map
  }, [data, itemsMap])

  return { data, status: query.status, itemsMap, parentItemsMap }
}

/**
 * Consumer hook — reads from context.
 */
export const useTrashedSidebarItems = (): TrashedSidebarItemsValue => {
  const ctx = useContext(TrashedSidebarItemsContext)
  if (!ctx) {
    throw new Error(
      'useTrashedSidebarItems must be used within a TrashedSidebarItemsProvider',
    )
  }
  return ctx
}

/**
 * Recursively counts all descendants of a folder using a parentItemsMap.
 */
export function getDescendantCount(
  folderId: Id<'folders'>,
  parentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>,
  visited: Set<Id<'folders'>> = new Set(),
): number {
  if (visited.has(folderId)) return 0
  visited.add(folderId)
  const children = parentItemsMap.get(folderId) ?? []
  let count = children.length
  for (const child of children) {
    if (isFolder(child)) {
      count += getDescendantCount(child._id, parentItemsMap, visited)
    }
  }
  return count
}

export const sortItemsByOptions = (
  options: SortOptions,
  items?: Array<AnySidebarItem>,
) => {
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
      case SORT_ORDERS.DateModified:
        return options.direction === SORT_DIRECTIONS.Ascending
          ? a.updatedTime - b.updatedTime
          : b.updatedTime - a.updatedTime
      default:
        return assertNever(options.order)
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
    const map = new Map<Id<'folders'> | null, Array<AnySidebarItem>>()
    filteredData.forEach((item) => {
      const effectiveParentId =
        item.parentId && !filteredItemsMap.has(item.parentId)
          ? null
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
