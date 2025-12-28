import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useSidebarItemsByParent } from './useSidebarItems'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { TagCategory } from 'convex/tags/types'
import { useCampaign } from '~/contexts/CampaignContext'
import { isTagCategory } from '~/lib/sidebar-item-utils'

interface UseFolderViewOptions {
  parentItem: AnySidebarItem | null
}

interface UseFolderViewReturn {
  items: Array<AnySidebarItem>
  isLoading: boolean
  category?: TagCategory
}

export function useFolderView({
  parentItem,
}: UseFolderViewOptions): UseFolderViewReturn {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  // Get items by parent (folderized view)
  const parentId: SidebarItemId | undefined = parentItem?._id
  const itemsByParent = useSidebarItemsByParent(parentId)

  // All items for rendering
  const items = useMemo(() => {
    const data = itemsByParent.data ?? []
    return data
  }, [itemsByParent.data])

  // Fetch category data if the current parent is a folder with a categoryId
  const categoryFromFolderQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      parentItem &&
        !isTagCategory(parentItem) &&
        parentItem.categoryId &&
        campaignId
        ? { id: parentItem.categoryId, campaignId }
        : 'skip',
    ),
  )

  // Get category from either the parent category or the folder's category
  const category: TagCategory | undefined = useMemo(() => {
    if (isTagCategory(parentItem)) {
      return parentItem
    }
    const folderCategory = categoryFromFolderQuery.data
    if (folderCategory && isTagCategory(folderCategory)) {
      return folderCategory
    }
    return undefined
  }, [parentItem, categoryFromFolderQuery.data])

  const isLoading =
    campaignWithMembership.status === 'pending' ||
    itemsByParent.status === 'pending' ||
    (parentItem?.categoryId
      ? categoryFromFolderQuery.status === 'pending'
      : false)

  return {
    items,
    isLoading,
    category,
  }
}
