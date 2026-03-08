import { useMatch } from '@tanstack/react-router'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'

import { useCampaign } from '~/hooks/useCampaign'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

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
      staleTime: Infinity,
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

  return {
    item,
    itemType: item?.type,
    isLoading: typeAndSlug !== null && !item && sidebarItemQuery.isFetching,
    editorSearch,
    hasRequestedItem: typeAndSlug !== null,
  }
}
