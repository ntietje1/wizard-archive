import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useCampaign } from '~/hooks/useCampaign'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

const createContentSearch = (updates: Partial<EditorSearch>): EditorSearch => {
  const search: EditorSearch = {
    note: undefined,
    tag: undefined,
    map: undefined,
    category: undefined,
    folder: undefined,
    file: undefined,
    ...updates,
  }
  return search
}

export const useEditorNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const queryClient = useQueryClient()

  const routeParams = useMemo(
    () => ({ dmUsername, campaignSlug }),
    [dmUsername, campaignSlug],
  )

  const navigateToEditor = useCallback(
    (
      search: EditorSearch | ((prev: EditorSearch) => EditorSearch),
      replace?: boolean,
    ) => {
      navigate({
        to: EDITOR_ROUTE,
        params: routeParams,
        search,
        replace,
      })
    },
    [navigate, routeParams],
  )

  const navigateToNote = useCallback(
    (slug: string | null, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          note: slug || undefined,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToMap = useCallback(
    (slug: string, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          map: slug,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToTag = useCallback(
    (slug: string | null, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          tag: slug || undefined,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToCategory = useCallback(
    (slug: string, folderSlug?: string, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          category: slug,
          folder: folderSlug || undefined,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToFolder = useCallback(
    (slug: string, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          folder: slug,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToFile = useCallback(
    (slug: string, replace?: boolean) => {
      navigateToEditor(
        createContentSearch({
          file: slug,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const optimisticUpdateSidebarItem = useCallback(
    (item: AnySidebarItem) => {
      if (!campaignId) return
      queryClient.setQueryData(
        [
          convexQuery,
          api.sidebarItems.queries.getSidebarItemBySlug,
          { campaignId, type: item.type, slug: item.slug },
        ],
        item,
      )
      queryClient.setQueryData(
        [
          convexQuery,
          api.sidebarItems.queries.getSidebarItem,
          { campaignId, id: item._id },
        ],
        item,
      )
    },
    [queryClient, campaignId],
  )

  const navigateToItem = useCallback(
    (item: AnySidebarItem, replace?: boolean) => {
      optimisticUpdateSidebarItem(item)

      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes:
          navigateToNote(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.tags:
          navigateToTag(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.gameMaps:
          navigateToMap(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.tagCategories:
          navigateToCategory(item.slug, undefined, replace)
          break
        case SIDEBAR_ITEM_TYPES.folders:
          navigateToFolder(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.files:
          navigateToFile(item.slug, replace)
          break
        default: {
          // @ts-ignore - exhaustive check for unknown item types
          console.error('Invalid item type:', item.type)
        }
      }
    },
    [
      navigateToNote,
      navigateToTag,
      navigateToMap,
      navigateToCategory,
      navigateToFolder,
      navigateToFile,
      optimisticUpdateSidebarItem,
    ],
  )

  const clearEditorContent = useCallback(() => {
    navigateToEditor(createContentSearch({}))
  }, [navigateToEditor])

  return {
    navigateToNote,
    navigateToTag,
    navigateToMap,
    navigateToCategory,
    navigateToFolder,
    navigateToFile,
    navigateToItem,
    clearEditorContent,
  }
}
