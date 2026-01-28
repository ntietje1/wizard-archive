import { useMatch } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

export function useCurrentItem() {
  const { campaignWithMembership } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
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

  // For DMs viewing as player: also query without the filter so they can still share/manage
  const dmItemQuery = useQuery({
    ...convexQuery(
      api.sidebarItems.queries.getSidebarItemBySlug,
      typeAndSlug && campaignId
        ? {
            campaignId,
            type: typeAndSlug.type,
            slug: typeAndSlug.slug,
          }
        : 'skip',
    ),
    placeholderData: keepPreviousData,
  })

  const item = sidebarItemQuery.data ?? null
  const itemForDm = viewAsPlayerId ? (dmItemQuery.data ?? item) : item

  const itemType = item?.type
  const isLoading = typeAndSlug !== null && !item && sidebarItemQuery.isPending

  return {
    item,
    itemForDm,
    itemType,
    isLoading,
    editorSearch,
    hasRequestedItem: typeAndSlug !== null,
  }
}
