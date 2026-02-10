import { useCallback } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

export function useOpenParentFolders() {
  const { openFolder } = useFileSidebar()
  const { getAncestorSidebarItems } = useAllSidebarItems()

  const openParentFolders = useCallback(
    (itemId: SidebarItemId) => {
      const ancestors = getAncestorSidebarItems(itemId)
      ancestors.forEach((ancestor) => {
        openFolder(ancestor._id)
      })
    },
    [openFolder, getAncestorSidebarItems],
  )

  return { openParentFolders }
}
