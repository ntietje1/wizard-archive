import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useEffect, useMemo } from 'react'
import { debounce } from 'lodash-es'
import { useSearch } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { useNoteActions } from './useNoteActions'
import type { CustomBlock } from '~/lib/editor-schema'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useEditorNavigation } from './useEditorNavigation'
import usePersistedState from './usePersistedState'

export const useCurrentPage = (
  noteSlug: string | undefined,
  campaignId: Id<'campaigns'> | undefined,
) => {
  const { createPage, updatePageContentWithSanitization } = useNoteActions()
  const { navigateToPage } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const pageSlug = search.page

  const pagesQuery = useQuery(
    convexQuery(
      api.pages.queries.getPagesByNoteSlug,
      noteSlug && campaignId ? { campaignId, noteSlug } : 'skip',
    ),
  )

  // Extract pages array and noteId from query result
  const pagesArray = pagesQuery.data?.pages ?? []
  const noteId = pagesQuery.data?.noteId ?? undefined

  // Transform query result to match expected format (pages.data should be the array)
  const pages = {
    ...pagesQuery,
    data: pagesArray,
  }

  const [persistedPageSlug, setPersistedPageSlug] = usePersistedState<
    string | null
  >(`page-slug-${noteSlug ?? 'none'}`, null)

  const effectivePageSlug = pageSlug ?? persistedPageSlug ?? pagesArray[0]?.slug
  const pageId = pagesArray.find((p) => p.slug === effectivePageSlug)?._id

  const currentPage = useQuery(
    convexQuery(
      api.pages.queries.getPageWithContent,
      pageId ? { pageId } : 'skip',
    ),
  )

  const handleCreatePage = async () => {
    if (!noteId) return
    const result = await createPage.mutateAsync({
      noteId,
      title: 'New Page',
      type: 'text',
    })
    setPersistedPageSlug(result.slug)
    navigateToPage(noteId, result.slug)
  }

  const selectPage = (slug: string) => {
    if (!noteId) return
    setPersistedPageSlug(slug)
    navigateToPage(noteId, slug)
  }

  const updateCurrentPageContent = useMemo(
    () =>
      debounce((newContent: CustomBlock[]) => {
        if (!currentPage.data?._id) return
        updatePageContentWithSanitization(currentPage.data._id, newContent)
      }, 800),
    [updatePageContentWithSanitization, currentPage.data?._id],
  )

  // Flush debounce on unmount or page change
  useEffect(() => {
    return () => {
      updateCurrentPageContent.flush()
    }
  }, [currentPage.data?._id, updateCurrentPageContent])

  return {
    pages,
    currentPage: currentPage.data ?? null,
    pageSlug: effectivePageSlug,
    selectPage,
    handleCreatePage,
    updateCurrentPageContent,
  }
}
