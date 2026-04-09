import { useMatch } from '@tanstack/react-router'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'

import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'

export function useCurrentItem() {
  const { campaignId } = useCampaign()

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
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

  const rawItem = slug ? (sidebarItemQuery.data ?? null) : null

  const isStale = rawItem && slug && rawItem.slug !== slug

  const item = isStale ? null : rawItem

  const queryReturnedNull =
    rawItem === null && sidebarItemQuery.status === 'success' && !sidebarItemQuery.isFetching

  const hasRequestedItem = slug !== null
  const isLoading = hasRequestedItem && !item && !queryReturnedNull
  const isNotFound = hasRequestedItem && !item && !isLoading

  return {
    item,
    itemType: item?.type,
    isLoading,
    isNotFound,
    editorSearch,
    hasRequestedItem,
  }
}
