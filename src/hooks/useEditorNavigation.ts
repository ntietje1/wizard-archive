import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { useLastEditorItem } from './useLastEditorItem'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useCampaign } from '~/hooks/useCampaign'
import { isOptimistic } from '~/lib/sidebar-item-utils'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

const createContentSearch = (updates: Partial<EditorSearch>): EditorSearch => {
  const search: EditorSearch = {
    note: undefined,
    map: undefined,
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
  const { setLastSelectedItem } = useLastEditorItem()

  const routeParams = useMemo(
    () => ({ dmUsername, campaignSlug }),
    [dmUsername, campaignSlug],
  )

  const navigateToEditor = useCallback(
    async (
      search: EditorSearch | ((prev: EditorSearch) => EditorSearch),
      replace?: boolean,
    ) => {
      await navigate({
        to: EDITOR_ROUTE,
        params: routeParams,
        search,
        replace,
      })
    },
    [navigate, routeParams],
  )

  const navigateToNote = useCallback(
    async (slug: string | null, replace?: boolean) => {
      await navigateToEditor(
        createContentSearch({
          note: slug || undefined,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToMap = useCallback(
    async (slug: string, replace?: boolean) => {
      await navigateToEditor(
        createContentSearch({
          map: slug,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToFolder = useCallback(
    async (slug: string, replace?: boolean) => {
      await navigateToEditor(
        createContentSearch({
          folder: slug,
        }),
        replace,
      )
    },
    [navigateToEditor],
  )

  const navigateToFile = useCallback(
    async (slug: string, replace?: boolean) => {
      await navigateToEditor(
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
      if (!isOptimistic(item)) {
        queryClient.setQueryData(
          [
            convexQuery,
            api.sidebarItems.queries.getSidebarItem,
            { campaignId, id: item._id },
          ],
          item,
        )
      }
    },
    [queryClient, campaignId],
  )

  const navigateToItem = useCallback(
    async (item: AnySidebarItem, replace?: boolean) => {
      optimisticUpdateSidebarItem(item)
      setLastSelectedItem({ type: item.type, slug: item.slug })

      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes:
          await navigateToNote(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.gameMaps:
          await navigateToMap(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.folders:
          await navigateToFolder(item.slug, replace)
          break
        case SIDEBAR_ITEM_TYPES.files:
          await navigateToFile(item.slug, replace)
          break
        default: {
          console.warn('Unknown item type', item)
        }
      }
    },
    [
      navigateToNote,
      navigateToMap,
      navigateToFolder,
      navigateToFile,
      optimisticUpdateSidebarItem,
      setLastSelectedItem,
    ],
  )

  const clearEditorContent = useCallback(async () => {
    await navigateToEditor(createContentSearch({}))
    setLastSelectedItem(null)
  }, [navigateToEditor, setLastSelectedItem])

  return {
    navigateToNote,
    navigateToMap,
    navigateToFolder,
    navigateToFile,
    navigateToItem,
    clearEditorContent,
  }
}
