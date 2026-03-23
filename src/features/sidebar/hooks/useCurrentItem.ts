import { useMatch } from '@tanstack/react-router'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'

import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/features/shared/hooks/useAuthQuery'
import { getTypeAndSlug } from '~/features/sidebar/utils/sidebar-item-utils'

export function useCurrentItem() {
  const { campaignId } = useCampaign()

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const typeAndSlug = getTypeAndSlug(editorSearch)

  const sidebarItemQuery = useAuthQuery(
    api.sidebarItems.queries.getSidebarItemBySlug,
    typeAndSlug && campaignId
      ? { campaignId, type: typeAndSlug.type, slug: typeAndSlug.slug }
      : 'skip',
    {
      placeholderData: typeAndSlug ? keepPreviousData : undefined,
    },
  )

  const rawItem = typeAndSlug ? (sidebarItemQuery.data ?? null) : null

  // When keepPreviousData is active, we may have stale data from a different
  // item while the new query loads. Detect this and treat it as loading.
  const isStale =
    rawItem &&
    typeAndSlug &&
    (rawItem.type !== typeAndSlug.type || rawItem.slug !== typeAndSlug.slug)

  const item = isStale ? null : rawItem

  // The query has definitively resolved with null for the current params
  // (not stale previous data, not still loading).
  const queryReturnedNull =
    rawItem === null &&
    sidebarItemQuery.status === 'success' &&
    !sidebarItemQuery.isFetching

  const hasRequestedItem = typeAndSlug !== null
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
