import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import type { Id } from 'convex/_generated/dataModel'
import {
  SORT_DIRECTIONS,
  SORT_ORDERS,
  type SortOptions,
} from 'convex/editors/types'
import { type AnySidebarItem } from 'convex/sidebarItems/types'
import { useSortOptions } from './useSortOptions'

export const useSidebarItemsByCategory = (
  categoryId: Id<'tagCategories'>,
  enabled = true,
) => {
  const { sortOptions } = useSortOptions()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const sidebarItems = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemsByCategory,
      campaign?._id && enabled
        ? {
            campaignId: campaign._id,
            categoryId: categoryId,
          }
        : 'skip',
    ),
  )
  return {
    ...sidebarItems,
    data: sortItemsByOptions(sortOptions, sidebarItems.data),
  }
}

export const useSidebarItemsByParent = (
  categoryId?: Id<'tagCategories'>,
  parentId?: Id<'notes'>,
  enabled = true,
) => {
  const { sortOptions } = useSortOptions()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const sidebarItems = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemsByParent,
      campaign?._id && enabled
        ? {
            campaignId: campaign._id,
            categoryId: categoryId,
            parentId: parentId,
          }
        : 'skip',
    ),
  )
  return {
    ...sidebarItems,
    data: sortItemsByOptions(sortOptions, sidebarItems.data),
  }
}

export const sortItemsByOptions = (
  options: SortOptions,
  items?: AnySidebarItem[],
) => {
  if (!items) return undefined
  return [...items].sort((a, b) => {
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
  })
}
