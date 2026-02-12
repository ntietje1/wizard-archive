import { useCallback } from 'react'
import { useMatch } from '@tanstack/react-router'
import { useEditorNavigation } from './useEditorNavigation'
import { useSidebarItemMutations } from './useSidebarItemMutations'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

export function useRenameItem() {
  const { rename: collectionRename } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigation()

  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}
  const selectedTypeAndSlug = getTypeAndSlug(editorSearch)

  const rename = useCallback(
    async (item: AnySidebarItem, newName: string) => {
      if (!item) return

      const previousSlug = item.slug

      // Optimistic update via collection (validates before applying, returns predicted slug)
      const result = collectionRename(item, newName)
      if (!result) return

      // If this is the currently viewed item and slug changed, update URL immediately
      const isCurrentItem =
        selectedTypeAndSlug &&
        item.type === selectedTypeAndSlug.type &&
        item.slug === selectedTypeAndSlug.slug

      if (isCurrentItem && result.newSlug !== previousSlug) {
        const updatedItem = { ...item, name: newName, slug: result.newSlug }
        await navigateToItem(updatedItem, true)
      }
    },
    [collectionRename, selectedTypeAndSlug, navigateToItem],
  )

  return {
    rename,
  }
}
