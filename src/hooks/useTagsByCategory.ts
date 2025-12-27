import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import {
  SORT_DIRECTIONS,
  SORT_ORDERS
  
} from 'convex/editors/types'
import { useSortOptions } from './useSortOptions'
import type {SortOptions} from 'convex/editors/types';
import type { Id } from 'convex/_generated/dataModel'
import type { Tag } from 'convex/tags/types'
import { useCampaign } from '~/contexts/CampaignContext'

export const useTagsByCategory = (
  categoryId: Id<'tagCategories'>,
  enabled = true,
) => {
  const { sortOptions } = useSortOptions()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const tags = useQuery(
    convexQuery(
      api.tags.queries.getTagsByCategory,
      campaign?._id && enabled
        ? {
            campaignId: campaign._id,
            categoryId,
          }
        : 'skip',
    ),
  )
  return {
    ...tags,
    data: sortTagsByOptions(sortOptions, tags.data),
  }
}

const sortTagsByOptions = (options: SortOptions, tags?: Array<Tag>) => {
  if (!tags) return undefined

  const sortFn = (a: Tag, b: Tag) => {
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

  return [...tags].sort(sortFn)
}
