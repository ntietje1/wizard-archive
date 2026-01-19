import { useCallback } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { useCurrentItem } from './useCurrentItem'
import { useEditorNavigation } from './useEditorNavigation'
import type {
  AnySidebarItem,
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types'

interface NavigateOnSlugChangeParams {
  itemId: SidebarItemId
  itemType: SidebarItemType
  previousSlug: string | undefined
  newSlug: string | undefined
  updatedItem?: AnySidebarItem
}

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
      // Only navigate if this is the current item and slug changed
      if (
        !newSlug ||
        !previousSlug ||
        newSlug === previousSlug ||
        !currentItem ||
        currentItem._id !== itemId
      ) {
        return
      }

      // If we have the full updated item, use navigateToItem for optimistic cache update
      if (updatedItem) {
        navigateToItem(updatedItem, true)
        return
      }

      // Otherwise, just navigate by slug based on type
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
