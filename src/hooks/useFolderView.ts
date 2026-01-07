import { useMemo } from 'react'
import { useSidebarItemsByParent } from './useSidebarItems'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

interface UseFolderViewOptions {
  parentItem: AnySidebarItem | null
}

interface UseFolderViewReturn {
  items: Array<AnySidebarItem>
  isLoading: boolean
}

export function useFolderView({
  parentItem,
}: UseFolderViewOptions): UseFolderViewReturn {
  const { campaignWithMembership } = useCampaign()

  // Get items by parent (folderized view)
  const parentId: SidebarItemId | undefined = parentItem?._id
  const itemsByParent = useSidebarItemsByParent(parentId)

  // All items for rendering
  const items: Array<AnySidebarItem> = useMemo(
    () => itemsByParent.data ?? [],
    [itemsByParent.data],
  )

  const isLoading =
    campaignWithMembership.status === 'pending' ||
    itemsByParent.status === 'pending'

  return {
    items,
    isLoading,
  }
}
