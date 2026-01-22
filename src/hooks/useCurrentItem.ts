import { useMatch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

export function useCurrentItem() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  // Determine type and slug from search params
  const getTypeAndSlug = () => {
    if (editorSearch.note) {
      return { type: SIDEBAR_ITEM_TYPES.notes, slug: editorSearch.note }
    }
    if (editorSearch.map) {
      return { type: SIDEBAR_ITEM_TYPES.gameMaps, slug: editorSearch.map }
    }
    if (editorSearch.folder) {
      return { type: SIDEBAR_ITEM_TYPES.folders, slug: editorSearch.folder }
    }
    if (editorSearch.file) {
      return { type: SIDEBAR_ITEM_TYPES.files, slug: editorSearch.file }
    }
    return null
  }

  const typeAndSlug = getTypeAndSlug()

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

  const item: AnySidebarItem | null = sidebarItemQuery.data ?? null

  const itemType = item?.type as SidebarItemType | undefined
  const isLoading = typeAndSlug !== null && sidebarItemQuery.isPending

  return {
    item,
    itemType,
    isLoading,
    editorSearch,
  }
}
