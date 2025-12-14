import { useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { isNote, isGameMap } from '~/lib/sidebar-item-utils'
import { useNoteActions } from './useNoteActions'
import { useEditorNavigation } from './useEditorNavigation'
import { useSearch } from '@tanstack/react-router'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import usePersistedState from './usePersistedState'
import type { CustomBlock } from '~/lib/editor-schema'
import { debounce } from 'lodash-es'

type UsePageLayoutParams = {
  parentId: SidebarItemId | undefined
  parentSlug: string | undefined
  campaignId: Id<'campaigns'> | undefined
}

export function usePageLayout({
  parentId,
  parentSlug,
  campaignId,
}: UsePageLayoutParams) {
  const { createChildNote, updateNoteContentWithSanitization } =
    useNoteActions()
  const { navigateToPage } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const pageSlug = search.page

  // Get all sidebar items (notes and maps) that are children of the parent
  const pagesQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemsByParent,
      parentId && campaignId
        ? {
            campaignId,
            parentId,
          }
        : 'skip',
    ),
  )

  const pagesArray: AnySidebarItem[] = pagesQuery.data ?? []

  const pages = {
    ...pagesQuery,
    data: pagesArray,
  }

  const [persistedPageSlug, setPersistedPageSlug] = usePersistedState<
    string | null
  >(`page-slug-${parentSlug ?? 'none'}`, null)

  const effectivePageSlug = pageSlug ?? persistedPageSlug ?? pagesArray[0]?.slug
  const currentPageItem = pagesArray.find((p) => p.slug === effectivePageSlug)

  const currentPage = useQuery(
    convexQuery(
      api.notes.queries.getNoteWithContent,
      isNote(currentPageItem) ? { noteId: currentPageItem._id } : 'skip',
    ),
  )

  const handleCreatePage = async () => {
    if (!parentId || !campaignId) return
    const result = await createChildNote.mutateAsync({
      parentId,
      name: 'New Page',
      campaignId,
    })
    if (!result.slug) return
    setPersistedPageSlug(result.slug)
    navigateToPage(result.slug)
  }

  const selectPage = (slug: string) => {
    setPersistedPageSlug(slug)
    navigateToPage(slug)
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
    pageSlug: effectivePageSlug,
    selectPage,
    handleCreatePage,
    updateCurrentPageContent,
  }
}

