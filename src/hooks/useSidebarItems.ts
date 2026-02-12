import { useCallback, useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { useSidebarItemsCollection } from './useSidebarItemsCollection'
import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { isFolder } from '~/lib/sidebar-item-utils'
import { useEditorMode } from '~/hooks/useEditorMode'
import {
  hasAtLeastPermissionLevel,
  resolvePermissionLevel,
} from '~/lib/permission-utils'

export const useAllSidebarItems = (_enabled = true) => {
  const collection = useSidebarItemsCollection()

  const liveResult = useLiveQuery(
    (q) => {
      if (!collection) return undefined
      return q.from({ item: collection })
    },
    [collection],
  )

  const data: Array<AnySidebarItem> = useMemo(
    () => liveResult?.data ?? [],
    [liveResult?.data],
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

  const status = collection ? 'success' : ('pending' as const)

  return {
    data,
    status,
    itemsMap: sidebarItemIdMap,
    parentItemsMap: sidebarItemParentIdMap,
    getAncestorSidebarItems,
  }
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
 * Returns sidebar items filtered by "view as player" permissions.
 * When viewAsPlayerId is set, filters to items the player can VIEW.
 * When unset (DM mode), returns all items.
 */
export const useFilteredSidebarItems = () => {
  const { viewAsPlayerId } = useEditorMode()
  const allItems = useAllSidebarItems()

  const filteredData = useMemo(() => {
    if (!viewAsPlayerId) return allItems.data
    return allItems.data.filter((item) => {
      const level = resolvePermissionLevel(
        item,
        viewAsPlayerId,
        allItems.itemsMap,
      )
      return hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.VIEW)
    })
  }, [allItems.data, allItems.itemsMap, viewAsPlayerId])

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
