import { useState, useCallback, useMemo } from 'react'
import { Plus, FolderPlus, Pencil, Trash2 } from '~/lib/icons'
import { useFolderState } from '~/hooks/useFolderState'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Folder } from 'convex/notes/types'
import { useFolderActions } from '~/hooks/useFolderActions'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { ContextMenuItem } from '~/components/context-menu/context-menu'
import type { FolderFormValues } from '~/components/forms/folder-dialog/folder-dialog'
import { useSidebarItemsByParent } from './useSidebarItems'

export function useCategoryCreateItem(
  categoryConfig: TagCategoryConfig | undefined,
  folder?: Folder,
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
  folder?: Folder,
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
        parentFolderId: folder?._id,
        campaignId: campaign._id,
        categoryId: getCategory.data._id,
      })
      .then((folderId: Id<'folders'>) => {
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
      label: `New ${categoryConfig.singular} Folder`,
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
  folder?: Folder,
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
          parentFolderId: folder?._id,
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
      label: `New ${categoryConfig.singular} Folder`,
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

export function useCategoryRenameFolder(folder?: Folder) {
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

export function useCategoryEditFolder(folder?: Folder) {
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

export function useCategoryDeleteFolder(folder?: Folder) {
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
