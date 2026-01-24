import { useMatch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

export function useCurrentItem() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const typeAndSlug = getTypeAndSlug(editorSearch)

  const sidebarItemQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemBySlug,
      typeAndSlug && campaignId
        ? {
            campaignId,
            type: typeAndSlug.type,
            slug: typeAndSlug.slug,
          }
        : 'skip',
    ),
  )

  const item = sidebarItemQuery.data ?? null

  const itemType = item?.type
  const isLoading = typeAndSlug !== null && !item && sidebarItemQuery.isPending

  return {
    item,
    itemType,
    isLoading,
    editorSearch,
  }
}
