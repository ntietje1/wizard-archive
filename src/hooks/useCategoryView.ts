import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { useSidebarItems } from './useSidebarItems'
import { SIDEBAR_ITEM_TYPES, UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Tag, TagCategory } from 'convex/tags/types'
import type { Folder } from 'convex/notes/types'
import usePersistedState from './usePersistedState'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { getCategoryIcon } from '~/lib/category-icons'
import type { LucideIcon } from 'lucide-react'

export const CATEGORY_VIEW_MODE_STORAGE_KEY = 'category-view-mode'

export const VIEW_MODE = {
  flat: 'flat',
  folderized: 'folderized',
} as const

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]
export type FolderAncestor = { id: Id<'folders'>; name: string }

interface UseCategoryViewOptions {
  categorySlug: string
  currentFolderId?: string
  onNavigate: (folderId: string | undefined) => void
}

interface UseCategoryViewReturn {
  viewMode: ViewMode
  toggleViewMode: () => void

  tags?: Tag[]
  folders?: Folder[]
  categoryData?: TagCategory
  categoryConfig?: TagCategoryConfig
  isLoading: boolean

  breadcrumbs: Array<{ id: Id<'folders'>; name: string }>
  navigateToFolder: (folder: Folder) => void
  navigateToBreadcrumb: (index: number) => void

  isAtRoot: boolean
  hasContent: boolean
}

export function useCategoryView({
  categorySlug,
  currentFolderId,
  onNavigate,
}: UseCategoryViewOptions): UseCategoryViewReturn {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    `${CATEGORY_VIEW_MODE_STORAGE_KEY}-${categorySlug}`,
    VIEW_MODE.folderized,
  )

  const ancestorsQuery = useQuery(
    convexQuery(
      api.notes.queries.getFolderAncestors,
      currentFolderId && campaign?._id
        ? {
            folderId: currentFolderId as Id<'folders'>,
          }
        : 'skip',
    ),
  )

  const currentFolderQuery = useQuery(
    convexQuery(
      api.notes.queries.getFolder,
      currentFolderId && campaign?._id
        ? {
            folderId: currentFolderId as Id<'folders'>,
          }
        : 'skip',
    ),
  )

  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return []

    const ancestors = ancestorsQuery.data || []
    const ancestorBreadcrumbs = ancestors.map((folder) => ({
      id: folder._id,
      name: folder.name || UNTITLED_FOLDER_NAME,
    }))

    if (currentFolderQuery.data) {
      return [
        ...ancestorBreadcrumbs,
        {
          id: currentFolderQuery.data._id,
          name: currentFolderQuery.data.name || UNTITLED_FOLDER_NAME,
        },
      ]
    }

    return ancestorBreadcrumbs
  }, [currentFolderId, ancestorsQuery.data, currentFolderQuery.data])

  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign._id,
            slug: categorySlug,
          }
        : 'skip',
    ),
  )

  const tagsQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagsByCategory,
      campaign?._id && categoryQuery.data?._id
        ? { campaignId: campaign._id, categoryId: categoryQuery.data._id }
        : 'skip',
    ),
  )

  const sidebarItems = useSidebarItems(
    categoryQuery.data?._id,
    currentFolderId as Id<'folders'> | undefined,
    viewMode === VIEW_MODE.folderized,
  )

  const folders = useMemo(
    () =>
      sidebarItems.data?.filter(
        (item) => item.type === SIDEBAR_ITEM_TYPES.folders,
      ) as Folder[] | undefined,
    [sidebarItems.data],
  )

  const filteredTags = useMemo(() => {
    if (viewMode === VIEW_MODE.flat || !sidebarItems.data) {
      return tagsQuery.data
    }

    const tagIdsAtLevel = new Set(
      sidebarItems.data
        .filter((item) => item.type === SIDEBAR_ITEM_TYPES.notes)
        .map((item) => item?.tagId ?? undefined)
        .filter(Boolean),
    )

    return tagsQuery.data?.filter((tag) => tagIdsAtLevel.has(tag._id))
  }, [viewMode, sidebarItems.data, tagsQuery.data])

  const categoryConfig: TagCategoryConfig | undefined = categoryQuery.data
    ? {
        singular: categoryQuery.data.displayName,
        plural: categoryQuery.data.pluralDisplayName,
        categorySlug: categoryQuery.data.slug,
        icon: getCategoryIcon(categoryQuery.data.iconName),
      }
    : undefined

  const navigateToFolder = (folder: Folder) => {
    onNavigate(folder._id)
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      onNavigate(undefined)
    } else {
      const targetAncestor = breadcrumbs[index]
      onNavigate(targetAncestor?.id)
    }
  }

  const toggleViewMode = () => {
    setViewMode((prev) =>
      prev === VIEW_MODE.flat ? VIEW_MODE.folderized : VIEW_MODE.flat,
    )
    onNavigate(undefined)
  }

  const isLoading =
    campaignWithMembership.status === 'pending' ||
    categoryQuery.status === 'pending' ||
    tagsQuery.status === 'pending' ||
    (viewMode === VIEW_MODE.folderized && sidebarItems.status === 'pending') ||
    (viewMode === VIEW_MODE.folderized &&
      !!currentFolderId &&
      (ancestorsQuery.status === 'pending' ||
        currentFolderQuery.status === 'pending'))

  return {
    viewMode,
    toggleViewMode,
    tags: filteredTags,
    folders: viewMode === VIEW_MODE.folderized ? folders : undefined,
    categoryData: categoryQuery.data,
    categoryConfig,
    breadcrumbs,
    navigateToFolder,
    navigateToBreadcrumb,
    isLoading,
    isAtRoot: breadcrumbs.length === 0,
    hasContent: (filteredTags?.length ?? 0) > 0 || (folders?.length ?? 0) > 0,
  }
}
