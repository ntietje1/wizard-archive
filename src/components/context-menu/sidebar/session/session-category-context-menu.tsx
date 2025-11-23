import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import type { CategoryContextMenuProps } from '../generic/category-folder-context-menu'
import { Play, Calendar } from 'lucide-react'
import { forwardRef, useCallback, useMemo } from 'react'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFolderState } from '~/hooks/useFolderState'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import {
  useCategoryNewFolderWithDialog,
  useCategoryRenameFolder,
  useCategoryDeleteFolder,
  useEditCategory,
} from '~/hooks/useCategoryContextMenu'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'
import { useSession } from '~/hooks/useSession'
import { api } from 'convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'

export const SessionCategoryFolderContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(({ categoryConfig, children, folder }, ref) => {
  const { navigateToCategory } = useEditorNavigation()
  const { openFolder } = useFolderState(
    folder?._id || categoryConfig?.categorySlug || '',
  )
  const { startNewSession } = useSession()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const renameFolder = useCategoryRenameFolder(folder)
  const deleteFolder = useCategoryDeleteFolder(folder)
  const editCategory = useEditCategory(categoryConfig)

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

  const handleStartNewSession = useCallback(() => {
    if (!getCategory.data?._id) {
      toast.error('Failed to get category')
      return
    }
    // When folder is defined, create session inside that folder
    // When folder is undefined, create session at root
    // Explicitly use folder._id when folder exists to ensure correct parent
    const parentFolderId = folder ? folder._id : undefined
    console.log('Starting new session:', {
      folder: folder ? { _id: folder._id, name: folder.name } : null,
      parentFolderId,
      categoryId: getCategory.data._id,
    })
    if (folder) {
      // Open the folder so the new session is visible
      openFolder()
    }
    startNewSession({
      categoryId: getCategory.data._id,
      parentFolderId: parentFolderId,
    })
  }, [
    getCategory.data?._id,
    folder,
    startNewSession,
    openFolder,
  ])

  const menuItems = useMemo(() => {
    const items: ContextMenuItem[] = []
    
    // Show "Start New Session" at root level and in sub folders
    if (categoryConfig) {
      // Capture folder._id at menu creation time to ensure correct parent
      const currentFolderId = folder?._id
      items.push({
        type: 'action' as const,
        icon: <Play className="h-4 w-4" />,
        label: 'Start New Session',
        onClick: () => {
          if (!getCategory.data?._id) {
            toast.error('Failed to get category')
            return
          }
          if (folder) {
            openFolder()
          }
          startNewSession({
            categoryId: getCategory.data._id,
            parentFolderId: currentFolderId,
          })
        },
      })
    }

    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
    }
    // Only show edit category at root level (when folder is undefined)
    if (!folder && editCategory.menuItem) {
      items.push(editCategory.menuItem)
    }
    if (renameFolder.menuItem) {
      items.push(renameFolder.menuItem)
    }
    if (deleteFolder.menuItem) {
      items.push(deleteFolder.menuItem)
    }
    if (!folder && categoryConfig) {
      items.push({
        type: 'action' as const,
        icon: <Calendar className="h-4 w-4" />,
        label: `Go to ${categoryConfig.plural}`,
        onClick: () => {
          navigateToCategory('sessions')
        },
      })
    }
    return items
  }, [
    folder,
    categoryConfig,
    getCategory.data?._id,
    newFolder.menuItem,
    editCategory.menuItem,
    renameFolder.menuItem,
    deleteFolder.menuItem,
    navigateToCategory,
    startNewSession,
    openFolder,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>
      {categoryConfig && (
        <>
          <FolderDialog
            isOpen={newFolder.isDialogOpen}
            onClose={() => newFolder.setIsDialogOpen(false)}
            mode="create"
            onSubmit={newFolder.onSubmit}
          />
          {editCategory.category && (
            <CategoryDialog
              mode="edit"
              isOpen={editCategory.isDialogOpen}
              onClose={() => editCategory.setIsDialogOpen(false)}
              category={editCategory.category}
              onSuccess={editCategory.onCategoryUpdated}
            />
          )}
        </>
      )}
    </>
  )
})

