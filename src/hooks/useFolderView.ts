import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { TagCategory } from 'convex/tags/types'
import usePersistedState from './usePersistedState'
import {
  useSidebarItemsByCategory,
  useSidebarItemsByParent,
} from './useSidebarItems'
import { isTagCategory } from '~/lib/sidebar-item-utils'

export const FOLDER_VIEW_MODE_STORAGE_KEY = 'folder-view-mode'

export const VIEW_MODE = {
  flat: 'flat',
  folderized: 'folderized',
} as const

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]

interface UseFolderViewOptions {
  parentItem: AnySidebarItem | null
}

interface UseFolderViewReturn {
  items: AnySidebarItem[]
  isLoading: boolean
  category?: TagCategory
  viewMode: ViewMode
  toggleViewMode: () => void
  canToggleViewMode: boolean
}

export function useFolderView({
  parentItem,
}: UseFolderViewOptions): UseFolderViewReturn {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  // Determine if we're at a root level (category root or sidebar root)
  const isAtRoot = !parentItem || isTagCategory(parentItem)

  const categoryId = isTagCategory(parentItem)
    ? parentItem._id
    : parentItem?.categoryId

  // View mode only matters at root level
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    `${FOLDER_VIEW_MODE_STORAGE_KEY}-${parentItem?._id ?? 'root'}`,
    VIEW_MODE.folderized,
  )

  // Get items by parent (folderized view)
  const parentId: SidebarItemId | undefined = parentItem?._id
  const itemsByParent = useSidebarItemsByParent(parentId)

  // Get all items in category (flat view) - only used at root
  const itemsByCategory = useSidebarItemsByCategory(
    categoryId as Id<'tagCategories'>,
    isAtRoot && viewMode === VIEW_MODE.flat && !!categoryId,
  )

  // Use the appropriate data source based on view mode
  const itemsSource = useMemo(
    () =>
      isAtRoot && viewMode === VIEW_MODE.flat && categoryId
        ? itemsByCategory
        : itemsByParent,
    [isAtRoot, viewMode, categoryId, itemsByCategory, itemsByParent],
  )

  const data = itemsSource.data ?? []

  // All items for rendering
  const items = useMemo(() => {
    if (isAtRoot && viewMode === VIEW_MODE.flat) {
      // In flat view, don't show folders
      return data.filter((item) => item.type !== 'folders')
    }
    // In folderized view, show everything
    return data
  }, [isAtRoot, viewMode, data])

  // Fetch category data if the current parent is a folder with a categoryId
  const categoryFromFolderQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      parentItem &&
        !isTagCategory(parentItem) &&
        parentItem?.categoryId &&
        campaignId
        ? { id: parentItem.categoryId, campaignId }
        : 'skip',
    ),
  )

  // Get category from either the parent category or the folder's category
  const category: TagCategory | undefined = useMemo(() => {
    if (isTagCategory(parentItem)) {
      return parentItem as TagCategory
    }
    const category = categoryFromFolderQuery.data
    if (category && isTagCategory(category)) {
      return category
    }
    return undefined
  }, [parentItem, categoryFromFolderQuery.data])

  const isLoading =
    campaignWithMembership.status === 'pending' ||
    itemsSource.status === 'pending' ||
    (parentItem?.categoryId
      ? categoryFromFolderQuery.status === 'pending'
      : false)

  const toggleViewMode = () => {
    setViewMode((prev) =>
      prev === VIEW_MODE.flat ? VIEW_MODE.folderized : VIEW_MODE.flat,
    )
  }

  return {
    items,
    isLoading,
    category,
    viewMode,
    toggleViewMode,
    canToggleViewMode: isAtRoot,
  }
}
