import { useCallback } from 'react'
import { useEditorNavigationContext } from '~/contexts/EditorNavigationProvider'
import { getSelectedTypeAndSlug } from './useSelectedItem'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import type { AnySidebarItem } from 'convex/sidebarItems/types'

export function useRenameItem() {
  const { rename: collectionRename } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigationContext()

  const rename = useCallback(
    async (item: AnySidebarItem, newName: string) => {
      if (!item) return

      const previousSlug = item.slug

      // Optimistic update via mutations (validates before applying, returns predicted slug)
      const result = collectionRename(item, newName)
      if (!result) return

      // If this is the currently viewed item and slug changed, update URL immediately
      const current = getSelectedTypeAndSlug()
      const isCurrentItem =
        current &&
        item.type === current.type &&
        item.slug === current.slug

      if (isCurrentItem && result.newSlug !== previousSlug) {
        const updatedItem = { ...item, name: newName, slug: result.newSlug }
        await navigateToItem(updatedItem, true)
      }
    },
    [collectionRename, navigateToItem],
  )

  return {
    rename,
  }
}
