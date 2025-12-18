import { useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import { getEditorConfig } from '~/lib/editor-registry'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useCampaign } from '~/contexts/CampaignContext'
import { useAuth } from '@clerk/tanstack-react-start'

type ActiveSearchType = 'note' | 'tag' | 'map' | 'category' | 'folder' | null

export function useCurrentItem() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { isLoaded, isSignedIn } = useAuth()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const activeSearchType: ActiveSearchType = search.note
    ? 'note'
    : search.tag
      ? 'tag'
      : search.map
        ? 'map'
        : search.category
          ? 'category'
          : search.folder
            ? 'folder'
            : null

  const noteQuery = useQuery(
    convexQuery(
      api.notes.queries.getNoteBySlug,
      isLoaded && isSignedIn && search.note && campaignId
        ? { campaignId, slug: search.note }
        : 'skip',
    ),
  )

  const tagQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagBySlug,
      isLoaded && isSignedIn && search.tag && campaignId
        ? { campaignId, slug: search.tag }
        : 'skip',
    ),
  )

  const mapQuery = useQuery(
    convexQuery(
      api.gameMaps.queries.getMapBySlug,
      isLoaded && isSignedIn && search.map && campaignId
        ? { campaignId, slug: search.map }
        : 'skip',
    ),
  )

  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      isLoaded && isSignedIn && search.category && campaignId
        ? { campaignId, slug: search.category }
        : 'skip',
    ),
  )

  const folderBySlugQuery = useQuery(
    convexQuery(
      api.folders.queries.getFolderBySlug,
      isLoaded && isSignedIn && search.folder && campaignId
        ? { campaignId, slug: search.folder }
        : 'skip',
    ),
  )

  const folderQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      isLoaded &&
        isSignedIn &&
        search.category &&
        search.folderId &&
        campaignId
        ? { campaignId, id: search.folderId }
        : 'skip',
    ),
  )

  let item: AnySidebarItem | null = null
  if (activeSearchType === 'note') {
    item = noteQuery.data ?? null
  } else if (activeSearchType === 'tag') {
    item = tagQuery.data ?? null
  } else if (activeSearchType === 'map') {
    item = mapQuery.data ?? null
  } else if (activeSearchType === 'category') {
    item = search.folderId
      ? (folderQuery.data ?? null)
      : (categoryQuery.data ?? null)
  } else if (activeSearchType === 'folder') {
    item = folderBySlugQuery.data ?? null
  }

  const itemType = item?.type as SidebarItemType | undefined
  const config = itemType ? getEditorConfig(itemType) : undefined

  const isLoading =
    (activeSearchType === 'note' && noteQuery.status === 'pending') ||
    (activeSearchType === 'tag' && tagQuery.status === 'pending') ||
    (activeSearchType === 'map' && mapQuery.status === 'pending') ||
    (activeSearchType === 'category' &&
      (search.folderId
        ? folderQuery.status === 'pending'
        : categoryQuery.status === 'pending'))
    || (activeSearchType === 'folder' &&
      folderBySlugQuery.status === 'pending')

  return {
    item,
    itemType,
    config,
    isLoading,
    search,
  }
}

