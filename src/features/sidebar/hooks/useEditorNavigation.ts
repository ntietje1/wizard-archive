import { useNavigate } from '@tanstack/react-router'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useLastEditorItem } from './useLastEditorItem'
import { EDITOR_ROUTE } from './useEditorLinkProps'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { assertNever } from '~/shared/utils/utils'

const createContentSearch = (updates: Partial<EditorSearch>): EditorSearch => {
  const search: EditorSearch = {
    note: undefined,
    map: undefined,
    folder: undefined,
    file: undefined,
    trash: undefined,
    ...updates,
  }
  return search
}

export const useEditorNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const routeParams = { dmUsername, campaignSlug }

  const navigateToEditor = async (
    search: EditorSearch | ((prev: EditorSearch) => EditorSearch),
    replace?: boolean,
  ) => {
    await navigate({
      to: EDITOR_ROUTE,
      params: routeParams,
      search,
      replace,
    })
  }

  const navigateToNote = async (slug: string, replace?: boolean) => {
    await navigateToEditor(
      createContentSearch({
        note: slug,
      }),
      replace,
    )
  }

  const navigateToMap = async (slug: string, replace?: boolean) => {
    await navigateToEditor(
      createContentSearch({
        map: slug,
      }),
      replace,
    )
  }

  const navigateToFolder = async (slug: string, replace?: boolean) => {
    await navigateToEditor(
      createContentSearch({
        folder: slug,
      }),
      replace,
    )
  }

  const navigateToFile = async (slug: string, replace?: boolean) => {
    await navigateToEditor(
      createContentSearch({
        file: slug,
      }),
      replace,
    )
  }

  const navigateToItem = async (
    item: { type: SidebarItemType; slug: string },
    replace?: boolean,
  ) => {
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
      default:
        assertNever(item.type)
    }
  }

  const clearEditorContent = async () => {
    await navigateToEditor(createContentSearch({}))
    setLastSelectedItem(null)
  }

  const navigateToTrash = async () => {
    await navigateToEditor(createContentSearch({ trash: true }))
  }

  return {
    navigateToNote,
    navigateToMap,
    navigateToFolder,
    navigateToFile,
    navigateToItem,
    clearEditorContent,
    navigateToTrash,
  }
}
