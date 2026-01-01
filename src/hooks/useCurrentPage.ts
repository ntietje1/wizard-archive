import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useNoteActions } from './useNoteActions'
import { useEditorNavigation } from './useEditorNavigation'
import usePersistedState from './usePersistedState'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

type UseCurrentPageParams = {
  itemId: SidebarItemId | undefined
  itemSlug: string | undefined
  campaignId: Id<'campaigns'> | undefined
}

export function useCurrentPage({
  itemId,
  itemSlug,
  campaignId,
}: UseCurrentPageParams) {
  const { createChildNote } = useNoteActions()
  const { navigateToPage } = useEditorNavigation()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  })

  const pageSlug = search.page

  // Get the parent item itself
  const parentItemQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      itemId && campaignId
        ? {
            campaignId,
            id: itemId,
          }
        : 'skip',
    ),
  )

  const parentItem = parentItemQuery.data

  // Get all sidebar items that are children of the parent
  const pagesQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemsByParent,
      itemId && campaignId
        ? {
            campaignId,
            parentId: itemId,
          }
        : 'skip',
    ),
  )

  const childPagesArray: Array<AnySidebarItem> = pagesQuery.data ?? []

  // Combine parent item (as first page) with child pages
  const allPagesArray: Array<AnySidebarItem> = parentItem
    ? [parentItem, ...childPagesArray]
    : childPagesArray

  const pages = {
    ...pagesQuery,
    data: allPagesArray,
    status:
      pagesQuery.status === 'pending' || parentItemQuery.status === 'pending'
        ? 'pending'
        : pagesQuery.status,
  }

  const [_persistedPageSlug, setPersistedPageSlug] = usePersistedState<
    string | null
  >(`page-slug-${itemSlug ?? 'none'}`, null)

  // Sync persisted state with URL (for cross-item persistence, not for browser navigation)
  useEffect(() => {
    if (pageSlug !== undefined) {
      setPersistedPageSlug(pageSlug)
    } else {
      setPersistedPageSlug(null)
    }
  }, [pageSlug, setPersistedPageSlug])

  // if no page slug is provided, show parent item (undefined means parent)
  // if page slug is provided, find that child page
  // Only use URL state for browser navigation compatibility
  const effectivePageSlug = pageSlug ?? undefined
  const currentPageItem = effectivePageSlug
    ? childPagesArray.find((p) => p.slug === effectivePageSlug)
    : (parentItem ?? undefined)

  const handleCreatePage = async () => {
    if (!itemId || !campaignId) return
    const result = await createChildNote.mutateAsync({
      parentId: itemId,
      name: '',
      campaignId,
    })
    if (!result.slug) return
    setPersistedPageSlug(result.slug)
    navigateToPage(result.slug)
  }

  const selectPage = (slug: string | undefined) => {
    if (slug === undefined) {
      // Clear page slug to show parent item
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: (prev) => ({
          ...prev,
          page: undefined,
        }),
      })
    } else {
      navigateToPage(slug)
    }
  }

  return {
    pages,
    currentPageItem,
    pageSlug: effectivePageSlug,
    selectPage,
    handleCreatePage,
  }
}
