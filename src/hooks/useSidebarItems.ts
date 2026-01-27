import { useCallback, useMemo } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'
import { isFolder } from '~/lib/sidebar-item-utils'

// TODO: remove the need for this hook
export const useSidebarItemsByParent = (
  parentId?: Id<'folders'>,
  enabled = true,
) => {
  const { campaignWithMembership } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const campaign = campaignWithMembership.data?.campaign
  const sidebarItems = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemsByParent,
      campaign?._id && enabled
        ? {
            campaignId: campaign._id,
            parentId,
            viewAsPlayerId,
          }
        : 'skip',
    ),  
  )
  return {
    ...sidebarItems,
    data: sidebarItems.data,
  }
}

export const useAllSidebarItems = (enabled = true) => {
  const { campaignWithMembership } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const campaign = campaignWithMembership.data?.campaign
  const sidebarItemsQuery = useQuery({
    ...convexQuery(
      api.sidebarItems.queries.getAllSidebarItems,
      campaign?._id && enabled
        ? { campaignId: campaign._id, viewAsPlayerId }
        : 'skip',
    ),
    placeholderData: keepPreviousData,
  })

  const sidebarItemIdMap = useMemo(() => {
    const sidebarItems = sidebarItemsQuery.data ?? []
    const map = new Map<SidebarItemId, AnySidebarItem>()
    sidebarItems.forEach((item) => {
      map.set(item._id, item)
    })
    return map
  }, [sidebarItemsQuery.data])

  const sidebarItemParentIdMap = useMemo(() => {
    const sidebarItems = sidebarItemsQuery.data ?? []
    const map = new Map<Id<'folders'> | undefined, Array<AnySidebarItem>>()
    sidebarItems.forEach((item) => {
      if (map.has(item.parentId)) {
        map.get(item.parentId)?.push(item)
      } else {
        map.set(item.parentId, [item])
      }
    })
    return map
  }, [sidebarItemsQuery.data])

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
    ...sidebarItemsQuery,
    data: sidebarItemsQuery.data ?? [],
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
