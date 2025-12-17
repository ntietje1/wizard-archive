import { useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { isNote, isGameMap } from '~/lib/sidebar-item-utils'
import { useNoteActions } from './useNoteActions'
import { useEditorNavigation } from './useEditorNavigation'
import { useSearch, useNavigate } from '@tanstack/react-router'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import usePersistedState from './usePersistedState'
import type { CustomBlock } from '~/lib/editor-schema'
import { debounce } from 'lodash-es'
import { useCampaign } from '~/contexts/CampaignContext'

type UsePageLayoutParams = {
  itemId: SidebarItemId | undefined
  itemSlug: string | undefined
  campaignId: Id<'campaigns'> | undefined
}

export function usePageLayout({
  itemId,
  itemSlug,
  campaignId,
}: UsePageLayoutParams) {
  const { createChildNote, updateNoteContentWithSanitization } =
    useNoteActions()
  const { navigateToPage } = useEditorNavigation()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

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

  // Get all sidebar items (notes and maps) that are children of the parent
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

  const childPagesArray: AnySidebarItem[] = pagesQuery.data ?? []

  // Combine parent item (as first page) with child pages
  const allPagesArray: AnySidebarItem[] = parentItem
    ? [parentItem, ...childPagesArray]
    : childPagesArray

  const pages = {
    ...pagesQuery,
    data: allPagesArray,
    status: pagesQuery.status === 'pending' || parentItemQuery.status === 'pending' ? 'pending' : pagesQuery.status,
  }

  const [persistedPageSlug, setPersistedPageSlug] = usePersistedState<
    string | null
  >(`page-slug-${itemSlug ?? 'none'}`, null)

  // if no page slug is provided, show parent item (undefined means parent)
  // if page slug is provided, find that child page
  const effectivePageSlug = pageSlug ?? persistedPageSlug ?? undefined
  const currentPageItem = effectivePageSlug
    ? childPagesArray.find((p) => p.slug === effectivePageSlug)
    : parentItem ?? undefined

  const currentPage = useQuery(
    convexQuery(
      api.notes.queries.getNoteWithContent,
      isNote(currentPageItem) ? { noteId: currentPageItem._id } : 'skip',
    ),
  )

  const handleCreatePage = async () => {
    if (!itemId || !campaignId) return
    const result = await createChildNote.mutateAsync({
      parentId: itemId,
      name: 'New Page',
      campaignId,
    })
    if (!result.slug) return
    setPersistedPageSlug(result.slug)
    navigateToPage(result.slug)
  }

  const selectPage = (slug: string | undefined) => {
    if (slug === undefined) {
      // Clear page slug to show parent item
      setPersistedPageSlug(null)
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: (prev) => ({
          ...prev,
          page: undefined,
        }),
      })
    } else {
      setPersistedPageSlug(slug)
      navigateToPage(slug)
    }
  }

  const updateCurrentPageContent = useMemo(
    () =>
      debounce((newContent: CustomBlock[]) => {
        if (!isNote(currentPageItem)) return
        updateNoteContentWithSanitization(currentPageItem._id, newContent)
      }, 800),
    [updateNoteContentWithSanitization, currentPageItem],
  )

  useEffect(() => {
    return () => {
      updateCurrentPageContent.flush()
    }
  }, [currentPageItem?._id, updateCurrentPageContent])

  const currentPageData = isNote(currentPageItem)
    ? currentPage.data
    : isGameMap(currentPageItem)
      ? currentPageItem
      : null

  return {
    pages,
    currentPage: currentPageData,
    currentPageItem,
    pageSlug: effectivePageSlug,
    selectPage,
    handleCreatePage,
    updateCurrentPageContent,
  }
}

