import { useMatch } from '@tanstack/react-router'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'

import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

type QueryStatus = 'pending' | 'error' | 'success'

function findOptimisticItem(slug: string | null, items: Array<AnySidebarItem>) {
  if (!slug) return null
  return items.find((item) => item.slug === slug && isOptimisticSidebarItem(item)) ?? null
}

function resolveCurrentItemState({
  slug,
  rawItem,
  queryStatus,
  isFetching,
}: {
  slug: string | null
  rawItem: AnySidebarItem | null
  queryStatus: QueryStatus
  isFetching: boolean
}) {
  const item = rawItem && rawItem.slug === slug ? rawItem : null
  const hasRequestedItem = slug !== null
  const queryReturnedNull = rawItem === null && queryStatus === 'success' && !isFetching
  const isLoading = hasRequestedItem && !item && !queryReturnedNull

  return {
    item,
    itemType: item?.type,
    isLoading,
    isNotFound: hasRequestedItem && !item && !isLoading,
    hasRequestedItem,
  }
}

export function useCurrentItem() {
  const { campaignId } = useCampaign()
  const activeItems = useActiveSidebarItems()

  const editorMatch = useMatch({
    from: '/_app/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const slug = getSlug(editorSearch)

  const sidebarItemQuery = useAuthQuery(
    api.sidebarItems.queries.getSidebarItemBySlug,
    slug && campaignId ? { campaignId, slug } : 'skip',
    {
      placeholderData: slug ? keepPreviousData : undefined,
    },
  )

  const optimisticItem = findOptimisticItem(slug, activeItems.data)
  const contentItem: AnySidebarItemWithContent | null =
    slug && sidebarItemQuery.data?.slug === slug ? sidebarItemQuery.data : null
  const rawItem = slug ? (optimisticItem ?? contentItem) : null
  const state = resolveCurrentItemState({
    slug,
    rawItem,
    queryStatus: sidebarItemQuery.status,
    isFetching: sidebarItemQuery.isFetching,
  })

  return {
    ...state,
    contentItem,
    editorSearch,
  }
}
