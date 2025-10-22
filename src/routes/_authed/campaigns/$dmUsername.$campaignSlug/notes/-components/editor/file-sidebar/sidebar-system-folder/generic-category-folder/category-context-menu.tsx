import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { useState, forwardRef, useMemo, useCallback } from 'react'
import { Plus, FolderPlus, Pencil, Trash2 } from '~/lib/icons'
import { useFolderState } from '~/hooks/useFolderState'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { Folder } from 'convex/notes/types'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useSidebarItems } from '~/hooks/useSidebarItems'

export interface CategoryContextMenuProps {
  children: React.ReactNode
  categoryConfig: TagCategoryConfig
  folder?: Folder
  itemsTransformation?: (baseItems: ContextMenuItem[]) => ContextMenuItem[]
}

export const CategoryContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(
  (
    {
      children,
      categoryConfig,
      folder,
      itemsTransformation = (baseItems) => baseItems,
    },
    ref,
  ) => {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
      useState(false)
    const { openFolder } = useFolderState(
      folder?._id || categoryConfig.categorySlug,
    )
    const { campaignWithMembership } = useCampaign()
    const campaign = campaignWithMembership?.data?.campaign
    const { createFolder, deleteFolder } = useFolderActions()
    const { setRenamingId } = useFileSidebar()
    const sidebarItems = useSidebarItems(
      folder?.categoryId,
      folder?._id,
      folder !== undefined,
    )

    const hasDirectChildren = folder && (sidebarItems.data?.length || 0) > 0

    // Get the category ID for this folder
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

    const handleCreateItem = () => {
      openFolder()
      setIsCreateDialogOpen(true)
    }

    const handleNewFolder = async () => {
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
    }

    const handleRenameFolder = () => {
      if (folder) {
        setRenamingId(folder._id)
      }
    }

    const handleDeleteFolder = () => {
      setConfirmDeleteDialogOpen(true)
    }

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
          setConfirmDeleteDialogOpen(false)
        })
    }, [deleteFolder, folder])

    const baseMenuItems: ContextMenuItem[] = [
      {
        type: 'action' as const,
        icon: <Plus className="h-4 w-4" />,
        label: `New ${categoryConfig.singular}`,
        onClick: handleCreateItem,
      },
      {
        type: 'action' as const,
        icon: <FolderPlus className="h-4 w-4" />,
        label: `New ${categoryConfig.singular} Folder`,
        onClick: handleNewFolder,
      },
      // Only show rename and delete for sub category folders (not root category)
      ...(folder
        ? [
            {
              type: 'action' as const,
              icon: <Pencil className="h-4 w-4" />,
              label: 'Rename Folder',
              onClick: handleRenameFolder,
            },
            {
              type: 'action' as const,
              icon: <Trash2 className="h-4 w-4" />,
              label: 'Delete Folder',
              onClick: handleDeleteFolder,
              className: 'text-red-600 focus:text-red-600',
            },
          ]
        : []),
    ]

    const menuItems = useMemo(
      () => itemsTransformation(baseMenuItems),
      [itemsTransformation, baseMenuItems],
    )

    return (
      <>
        <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
          {children}
        </ContextMenu>

        <GenericTagDialog
          mode="create"
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          config={categoryConfig}
          parentFolderId={folder?._id}
        />

        {folder && (
          <ConfirmationDialog
            isOpen={confirmDeleteDialogOpen}
            onClose={() => setConfirmDeleteDialogOpen(false)}
            onConfirm={confirmDeleteFolderFn}
            title={`Delete ${folder.name || 'Folder'}`}
            description={
              hasDirectChildren ? (
                <p>
                  <strong>This folder isn't empty!</strong>
                  <br />
                  <span>
                    Are you sure you want to delete it and all its contents?
                  </span>
                </p>
              ) : (
                <p>Are you sure you want to delete this folder?</p>
              )
            }
            confirmLabel="Delete Folder"
            confirmVariant="destructive"
            icon={Trash2}
          />
        )}
      </>
    )
  },
)
