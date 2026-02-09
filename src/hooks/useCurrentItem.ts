import { useMatch } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/hooks/useCampaign'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

// TODO: simplify this by taking in the viewAsPlayerId (optional)
export function useCurrentItem(viewAsPlayerId?: Id<'campaignMembers'>) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const typeAndSlug = getTypeAndSlug(editorSearch)

  // Query with viewAsPlayerId filter (what the player would see)
  const sidebarItemQuery = useQuery({
    ...convexQuery(
      api.sidebarItems.queries.getSidebarItemBySlug,
      typeAndSlug && campaignId
        ? {
            campaignId,
            type: typeAndSlug.type,
            slug: typeAndSlug.slug,
            viewAsPlayerId,
          }
        : 'skip',
    ),
    placeholderData: keepPreviousData,
  })

  // When no item is requested (no search params), always return null
  // regardless of stale placeholderData from keepPreviousData
  const item = typeAndSlug ? (sidebarItemQuery.data ?? null) : null

  const itemType = item?.type
  const isLoading = typeAndSlug !== null && !item && sidebarItemQuery.isPending

  return {
    item,
    itemType,
    isLoading,
    editorSearch,
    hasRequestedItem: typeAndSlug !== null,
  }
}
