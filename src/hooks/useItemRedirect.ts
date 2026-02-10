import { useEffect } from 'react'
import { useEditorNavigation } from './useEditorNavigation'
import { useAllSidebarItems } from './useSidebarItems'
import type { AnySidebarItem } from 'convex/sidebarItems/types'

/**
 * When an item vanishes from its slug query (during a rename or delete),
 * this hook resolves the transition by checking itemsMap:
 * - Rename: item exists with a new slug → redirect there
 * - Delete: item gone from itemsMap → clear the editor
 */
export function useItemRedirect(item: AnySidebarItem | null) {
  const { itemsMap } = useAllSidebarItems()
  const { navigateToItem, clearEditorContent } = useEditorNavigation()

  useEffect(() => {
    if (!item) return
    const found = itemsMap.get(item._id)
    if (found && found.slug !== item.slug) {
      navigateToItem(found, true)
    } else if (!found) {
      clearEditorContent()
    }
  }, [item, itemsMap, navigateToItem, clearEditorContent])
}
