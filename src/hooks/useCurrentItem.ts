import { useMatch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useRef } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

export function useCurrentItem(viewAsPlayerId?: Id<'campaignMembers'>) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const typeAndSlug = getTypeAndSlug(editorSearch)

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
  })

  const lastItemRef = useRef<AnySidebarItemWithContent | null>(null)

  if (sidebarItemQuery.data) {
    lastItemRef.current = sidebarItemQuery.data
  } else if (lastItemRef.current?.slug !== typeAndSlug?.slug) {
    lastItemRef.current = null
  }

  const item = sidebarItemQuery.data ?? lastItemRef.current

  return {
    item,
    itemType: item?.type,
    isLoading: typeAndSlug !== null && !item && sidebarItemQuery.isPending,
    editorSearch,
    hasRequestedItem: typeAndSlug !== null,
  }
}
