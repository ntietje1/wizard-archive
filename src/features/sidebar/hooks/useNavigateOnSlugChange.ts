import { useCallback } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useCurrentItem } from './useCurrentItem'
import { useEditorNavigation } from './useEditorNavigation'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { assertNever } from '~/shared/utils/utils'

interface NavigateOnSlugChangeParams {
  itemId: SidebarItemId
  itemType: SidebarItemType
  previousSlug: string | undefined
  newSlug: string | undefined
  updatedItem?: AnySidebarItem
}

// TODO: remove the need for this
export function useNavigateOnSlugChange() {
  const { item: currentItem } = useCurrentItem()
  const {
    navigateToItem,
    navigateToNote,
    navigateToMap,
    navigateToFolder,
    navigateToFile,
  } = useEditorNavigation()

  const navigateIfSlugChanged = useCallback(
    ({
      itemId,
      itemType,
      previousSlug,
      newSlug,
      updatedItem,
    }: NavigateOnSlugChangeParams) => {
      if (
        !newSlug ||
        !previousSlug ||
        newSlug === previousSlug ||
        !currentItem ||
        currentItem._id !== itemId
      ) {
        return
      }

      if (updatedItem) {
        navigateToItem(updatedItem, true)
        return
      }

      switch (itemType) {
        case SIDEBAR_ITEM_TYPES.notes:
          navigateToNote(newSlug, true)
          break
        case SIDEBAR_ITEM_TYPES.gameMaps:
          navigateToMap(newSlug, true)
          break
        case SIDEBAR_ITEM_TYPES.folders:
          navigateToFolder(newSlug, true)
          break
        case SIDEBAR_ITEM_TYPES.files:
          navigateToFile(newSlug, true)
          break
        default:
          assertNever(itemType)
      }
    },
    [
      currentItem,
      navigateToItem,
      navigateToNote,
      navigateToMap,
      navigateToFolder,
      navigateToFile,
    ],
  )

  return { navigateIfSlugChanged }
}
