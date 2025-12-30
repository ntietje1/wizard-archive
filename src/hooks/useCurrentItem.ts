import { useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useAuth } from '@clerk/tanstack-react-start'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import { getEditorConfig } from '~/lib/editor-registry'
import { useCampaign } from '~/contexts/CampaignContext'

export function useCurrentItem() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { isLoaded, isSignedIn } = useAuth()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  })

  // Determine type and slug from search params
  const getTypeAndSlug = () => {
    if (search.note) {
      return { type: SIDEBAR_ITEM_TYPES.notes, slug: search.note }
    }
    if (search.tag) {
      return { type: SIDEBAR_ITEM_TYPES.tags, slug: search.tag }
    }
    if (search.map) {
      return { type: SIDEBAR_ITEM_TYPES.gameMaps, slug: search.map }
    }
    if (search.category && search.folder) {
      // When inside a category, folder takes precedence
      return { type: SIDEBAR_ITEM_TYPES.folders, slug: search.folder }
    }
    if (search.category) {
      return { type: SIDEBAR_ITEM_TYPES.tagCategories, slug: search.category }
    }
    if (search.folder) {
      return { type: SIDEBAR_ITEM_TYPES.folders, slug: search.folder }
    }
    return null
  }

  const typeAndSlug = getTypeAndSlug()

  // Unified query for slug-based items
  const sidebarItemQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemBySlug,
      isLoaded && isSignedIn && typeAndSlug && campaignId
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
  const config = itemType ? getEditorConfig(itemType) : undefined

  const isLoading = typeAndSlug !== null && sidebarItemQuery.isPending

  return {
    item,
    itemType,
    config,
    isLoading,
    search,
  }
}
