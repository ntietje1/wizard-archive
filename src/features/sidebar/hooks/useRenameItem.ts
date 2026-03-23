import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { getSelectedTypeAndSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useEditorNavigationContext } from '~/features/sidebar/hooks/useEditorNavigationContext'
import { useSidebarItemMutations } from '~/features/sidebar/hooks/useSidebarItemMutations'

export function useRenameItem() {
  const { rename: collectionRename } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigationContext()

  const rename = async (item: AnySidebarItem, newName: string) => {
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
  }

  return {
    rename,
  }
}
