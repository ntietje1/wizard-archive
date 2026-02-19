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

      const current = getSelectedTypeAndSlug()
      const isCurrentItem =
        current && item.type === current.type && item.slug === current.slug

      const { promise } = collectionRename(item, newName)

      if (isCurrentItem) {
        const res = await promise
        if (res?.slug && res.slug !== item.slug) {
          await navigateToItem({ type: item.type, slug: res.slug }, true)
        }
      }
    },
    [collectionRename, navigateToItem],
  )

  return {
    rename,
  }
}
