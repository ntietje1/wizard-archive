import { useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { SIDEBAR_ITEM_TYPES, UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import type { Id } from 'convex/_generated/dataModel'
import type { TagCategory } from 'convex/tags/types'
import type { Folder, Note, Map } from 'convex/notes/types'
import usePersistedState from './usePersistedState'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { getCategoryIcon } from '~/lib/category-icons'
import { CATEGORY_KIND } from 'convex/tags/types'
import {
  useSidebarItemsByCategory,
  useSidebarItemsByParent,
} from './useSidebarItems'

export const CATEGORY_VIEW_MODE_STORAGE_KEY = 'category-view-mode'
export const CATEGORY_FOLDER_SKELETON_COUNT_STORAGE_KEY =
  'category-folder-skeleton-count'
export const CATEGORY_NOTE_SKELETON_COUNT_STORAGE_KEY =
  'category-note-skeleton-count'

export const VIEW_MODE = {
  flat: 'flat',
  folderized: 'folderized',
} as const

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]
export type FolderAncestor = { id: Id<'folders'>; name: string }

interface UseCategoryViewOptions {
  categorySlug: string
  currentFolderId?: Id<'folders'>
  onNavigate: (folderId?: Id<'folders'>) => void
}

interface UseCategoryViewReturn {
  viewMode: ViewMode
  toggleViewMode: () => void

  notesAndTags?: Note[]
  folders?: Folder[]
  maps?: Map[]
  categoryData?: TagCategory
  categoryConfig?: TagCategoryConfig
  campaignId?: Id<'campaigns'>
  canEditCategory: boolean
  isLoading: boolean

  breadcrumbs: Array<{ id: Id<'folders'>; name: string }>
  navigateToFolder: (folder: Folder) => void
  navigateToBreadcrumb: (index: number) => void

  isAtRoot: boolean
  hasContent: boolean
  showSkeletons: boolean
  folderSkeletonCount: number
  noteSkeletonCount: number
  invalidFolderId: boolean
  categoryNotFound: boolean
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

  const [folderSkeletonCount, setFolderSkeletonCount] =
    usePersistedState<number>(
      `${CATEGORY_FOLDER_SKELETON_COUNT_STORAGE_KEY}-${categorySlug}-${currentFolderId}-${viewMode}`,
      0,
    )

  const [noteSkeletonCount, setNoteSkeletonCount] = usePersistedState<number>(
    `${CATEGORY_NOTE_SKELETON_COUNT_STORAGE_KEY}-${categorySlug}-${currentFolderId}-${viewMode}`,
    0,
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

  const sidebarItemsByParent = useSidebarItemsByParent(
    categoryQuery.data?._id,
    currentFolderId,
  )

  const sidebarItemsByCategory = useSidebarItemsByCategory(
    categoryQuery.data?._id as Id<'tagCategories'>,
    !!categoryQuery.data?._id,
  )

  const sidebarItems = useMemo(() => {
    if (viewMode === VIEW_MODE.folderized) {
      return sidebarItemsByParent
    }
    return sidebarItemsByCategory
  }, [viewMode, sidebarItemsByParent, sidebarItemsByCategory])

  const folders = useMemo(
    () =>
      sidebarItems.data?.filter(
        (item) => item.type === SIDEBAR_ITEM_TYPES.folders,
      ) as Folder[] | undefined,
    [sidebarItems.data],
  )

  const notes = useMemo(
    () =>
      sidebarItems.data?.filter(
        (item) => item.type === SIDEBAR_ITEM_TYPES.notes,
      ) as Note[] | undefined,
    [sidebarItems.data],
  )

  const maps = useMemo(
    () =>
      sidebarItems.data?.filter(
        (item) => item.type === SIDEBAR_ITEM_TYPES.maps,
      ) as Map[] | undefined,
    [sidebarItems.data],
  )

  const filteredNotesAndTags = useMemo(() => {
    if (!notes) {
      return undefined
    }

    if (viewMode === VIEW_MODE.flat) {
      return notes
    }

    const tagIdsAtLevel = new Set(
      notes.map((note) => note.tagId).filter(Boolean),
    )

    return notes.filter((note) => tagIdsAtLevel.has(note.tagId))
  }, [viewMode, notes])

  const categoryConfig: TagCategoryConfig | undefined = categoryQuery.data
    ? {
        singular: categoryQuery.data.displayName,
        plural: categoryQuery.data.pluralDisplayName,
        categorySlug: categoryQuery.data.slug,
        icon: getCategoryIcon(categoryQuery.data.iconName),
      }
    : undefined

  const canEditCategory =
    categoryQuery.data?.kind === CATEGORY_KIND.User ||
    categoryQuery.data?.kind === CATEGORY_KIND.SystemCore

  const invalidFolderId =
    sidebarItems.status === 'error' ||
    ancestorsQuery.status === 'error' ||
    currentFolderQuery.status === 'error'

  const categoryNotFound =
    campaign?._id !== undefined &&
    categoryQuery.status !== 'pending' &&
    categoryQuery.status === 'error'

  const isLoading =
    campaignWithMembership.status === 'pending' ||
    sidebarItems.status === 'pending' ||
    (viewMode === VIEW_MODE.folderized && invalidFolderId) ||
    (viewMode === VIEW_MODE.folderized &&
      !!currentFolderId &&
      (ancestorsQuery.status === 'pending' ||
        currentFolderQuery.status === 'pending'))

  const showSkeletons = isLoading

  useEffect(() => {
    if (!isLoading && sidebarItems.data) {
      const folderCount =
        viewMode === VIEW_MODE.folderized ? (folders?.length ?? 0) : 0
      const noteCount = filteredNotesAndTags?.length ?? 0

      if (folderCount > 0 && folderCount !== folderSkeletonCount) {
        setFolderSkeletonCount(folderCount)
      }
      if (noteCount > 0 && noteCount !== noteSkeletonCount) {
        setNoteSkeletonCount(noteCount)
      }
    }
  }, [
    isLoading,
    sidebarItems.data,
    viewMode,
    folders?.length,
    filteredNotesAndTags?.length,
    folderSkeletonCount,
    noteSkeletonCount,
    setFolderSkeletonCount,
    setNoteSkeletonCount,
  ])

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

  return {
    viewMode,
    toggleViewMode,
    notesAndTags: filteredNotesAndTags,
    folders: viewMode === VIEW_MODE.folderized ? folders : undefined,
    categoryData: categoryQuery.data,
    categoryConfig,
    campaignId: campaign?._id,
    canEditCategory,
    breadcrumbs,
    navigateToFolder,
    navigateToBreadcrumb,
    isLoading,
    isAtRoot: breadcrumbs.length === 0,
    hasContent:
      (filteredNotesAndTags?.length ?? 0) > 0 ||
      (folders?.length ?? 0) > 0 ||
      (maps?.length ?? 0) > 0,
    maps,
    showSkeletons,
    folderSkeletonCount,
    noteSkeletonCount,
    invalidFolderId,
    categoryNotFound,
  }
}
