import { useState, useCallback, useMemo } from 'react'
import { Plus, FolderPlus, Pencil, Trash2, MapPin, TagIcon } from '~/lib/icons'
import { useFolderState } from '~/hooks/useFolderState'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useFolderActions } from '~/hooks/useFolderActions'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { ContextMenuItem } from '~/components/context-menu/base/context-menu'
import type { FolderFormValues } from '~/components/forms/folder-dialog/folder-dialog'
import { useSidebarItemsByParent } from './useSidebarItems'
import { useEditorNavigation } from './useEditorNavigation'
import type { EditorSearch } from '~/components/notes-page/validate-search'

export function useCategoryCreateItem(
  categoryConfig: TagCategoryConfig | undefined,
  folder?: Note,
) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )

  const handleCreateItem = useCallback(() => {
    if (!categoryConfig) return
    openFolder()
    setIsDialogOpen(true)
  }, [openFolder, categoryConfig])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!categoryConfig) return null
    return {
      type: 'action' as const,
      icon: <Plus className="h-4 w-4" />,
      label: `New ${categoryConfig.singular}`,
      onClick: handleCreateItem,
    }
  }, [categoryConfig, handleCreateItem])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
  }
}

export function useCategoryNewFolder(
  categoryConfig: TagCategoryConfig,
  folder?: Note,
) {
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig.categorySlug,
  )
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const { createFolder } = useFolderActions()
  const { setRenamingId } = useFileSidebar()

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign._id,
            slug: categoryConfig.categorySlug,
          }
        : 'skip',
    ),
  )

  const handleNewFolder = useCallback(async () => {
    if (getCategory.isLoading) {
      toast.error('Please wait, loading category...')
      return
    }
    if (getCategory.isError) {
      toast.error('Failed to load category')
      return
    }
    if (!campaign || !getCategory.data) {
      toast.error('Campaign or category not found')
      return
    }

    await createFolder
      .mutateAsync({
        parentId: folder?._id,
        campaignId: campaign._id,
        categoryId: getCategory.data._id,
      })
      .then((folderId: Id<'notes'>) => {
        openFolder()
        setRenamingId(folderId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create folder')
      })
  }, [
    campaign,
    getCategory.data,
    createFolder,
    folder?._id,
    openFolder,
    setRenamingId,
  ])

  const menuItem: ContextMenuItem = useMemo(
    () => ({
      type: 'action' as const,
      icon: <FolderPlus className="h-4 w-4" />,
      label: `New Folder`,
      onClick: handleNewFolder,
    }),
    [categoryConfig.singular, handleNewFolder],
  )

  return {
    menuItem,
    handler: handleNewFolder,
  }
}

export function useCategoryNewFolderWithDialog(
  categoryConfig: TagCategoryConfig | undefined,
  folder?: Note,
) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const { createFolder } = useFolderActions()

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id && categoryConfig
        ? {
            campaignId: campaign._id,
            slug: categoryConfig.categorySlug,
          }
        : 'skip',
    ),
  )

  const handleNewFolder = useCallback(() => {
    if (!categoryConfig) return
    openFolder()
    setIsDialogOpen(true)
  }, [openFolder, categoryConfig])

  const handleSubmit = useCallback(
    async (values: FolderFormValues) => {
      if (getCategory.isLoading) {
        toast.error('Please wait, loading category...')
        return
      }
      if (getCategory.isError) {
        toast.error('Failed to load category')
        return
      }
      if (!campaign || !getCategory.data) {
        toast.error('Campaign or category not found')
        return
      }

      await createFolder
        .mutateAsync({
          name: values.name,
          parentId: folder?._id,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
        })
        .then(() => {
          setIsDialogOpen(false)
          toast.success('Folder created')
        })
        .catch((error: Error) => {
          console.error(error)
          toast.error('Failed to create folder')
        })
    },
    [campaign, getCategory, createFolder, folder?._id],
  )

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!categoryConfig) return null
    return {
      type: 'action' as const,
      icon: <FolderPlus className="h-4 w-4" />,
      label: `New Folder`,
      onClick: handleNewFolder,
    }
  }, [categoryConfig, handleNewFolder])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    onSubmit: handleSubmit,
  }
}

export function useCategoryRenameFolder(folder?: Note) {
  const { setRenamingId } = useFileSidebar()

  const handleRenameFolder = useCallback(() => {
    if (folder) {
      setRenamingId(folder._id)
    }
  }, [folder, setRenamingId])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!folder) return null

    return {
      type: 'action' as const,
      icon: <Pencil className="h-4 w-4" />,
      label: 'Rename Folder',
      onClick: handleRenameFolder,
    }
  }, [folder, handleRenameFolder])

  return {
    menuItem,
  }
}

export function useCategoryEditFolder(folder?: Note) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleEditFolder = useCallback(() => {
    if (folder) {
      setIsDialogOpen(true)
    }
  }, [folder])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!folder) return null

    return {
      type: 'action' as const,
      icon: <Pencil className="h-4 w-4" />,
      label: 'Edit Folder',
      onClick: handleEditFolder,
    }
  }, [folder, handleEditFolder])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
  }
}

export function useCategoryDeleteFolder(folder?: Note) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { deleteFolder } = useFolderActions()
  const sidebarItems = useSidebarItemsByParent(
    folder?.categoryId,
    folder?._id,
    folder !== undefined,
  )

  const hasDirectChildren = folder && (sidebarItems.data?.length || 0) > 0

  const handleDeleteFolder = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const confirmDeleteFolderFn = useCallback(async () => {
    if (!folder) return

    await deleteFolder
      .mutateAsync({ folderId: folder._id })
      .then(() => {
        toast.success('Folder deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete folder')
      })
      .finally(() => {
        setIsDialogOpen(false)
      })
  }, [deleteFolder, folder])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!folder) return null

    return {
      type: 'action' as const,
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Delete Folder',
      onClick: handleDeleteFolder,
      className: 'text-red-600 focus:text-red-600',
    }
  }, [folder, handleDeleteFolder])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    confirmDeleteFolderFn,
    hasDirectChildren,
  }
}

export function useCategoryNewMap(
  categoryConfig: TagCategoryConfig | undefined,
  folder?: Note,
) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id && categoryConfig
        ? {
            campaignId: campaign._id,
            slug: categoryConfig.categorySlug,
          }
        : 'skip',
    ),
  )

  const handleNewMap = useCallback(() => {
    if (!categoryConfig) return
    openFolder()
    setIsDialogOpen(true)
  }, [openFolder, categoryConfig])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!categoryConfig) {
      return null
    }
    return {
      type: 'action' as const,
      icon: <MapPin className="h-4 w-4" />,
      label: 'New Map',
      onClick: handleNewMap,
    }
  }, [categoryConfig, handleNewMap])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    campaignId: campaign?._id,
    categoryId: getCategory.data?._id,
    parentId: folder?._id,
  }
}

export function useNewMap(folder?: Note) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const handleNewMap = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!campaign) {
      return null
    }
    return {
      type: 'action' as const,
      icon: <MapPin className="h-4 w-4" />,
      label: 'New Map',
      onClick: handleNewMap,
    }
  }, [campaign, handleNewMap])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    campaignId: campaign?._id,
    categoryId: undefined,
    parentId: folder?._id,
  }
}

export function useEditCategory(categoryConfig: TagCategoryConfig | undefined) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const { navigateToCategory } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id && categoryConfig
        ? {
            campaignId: campaign._id,
            slug: categoryConfig.categorySlug,
          }
        : 'skip',
    ),
  )

  const handleEditCategory = useCallback(() => {
    if (categoryConfig) {
      setIsDialogOpen(true)
    }
  }, [categoryConfig])

  const handleCategoryUpdated = useCallback(
    (newSlug: string) => {
      setIsDialogOpen(false)
      toast.success('Category updated successfully')

      // If category slug changed and user is currently on this category's page, navigate them
      if (
        categoryConfig &&
        search.category === categoryConfig.categorySlug &&
        newSlug !== categoryConfig.categorySlug
      ) {
        navigateToCategory(
          newSlug,
          search.folderId ? (search.folderId as Id<'notes'>) : undefined,
        )
      }
    },
    [categoryConfig, search.category, search.folderId, navigateToCategory],
  )

  const menuItem: ContextMenuItem | null = useMemo(() => {
    if (!categoryConfig) return null
    const Icon = categoryConfig.icon || TagIcon
    return {
      type: 'action' as const,
      icon: <Icon className="h-4 w-4" />,
      label: 'Edit Category',
      onClick: handleEditCategory,
    }
  }, [categoryConfig, handleEditCategory])

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    category: getCategory.data,
    isLoading: getCategory.isLoading,
    onCategoryUpdated: handleCategoryUpdated,
  }
}
