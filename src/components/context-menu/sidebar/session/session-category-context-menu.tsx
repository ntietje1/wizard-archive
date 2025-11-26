import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import type { CategoryContextMenuProps } from '../generic/category-folder-context-menu'
import { Play, SquareArrowOutUpRight, Square } from 'lucide-react'
import { forwardRef, useCallback, useMemo } from 'react'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFolderState } from '~/hooks/useFolderState'
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
  const { startNewSession, currentSession, endCurrentSession } = useSession()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const campaignId = campaign?._id

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

  const hasActiveSession = !!currentSession.data

  const handleStartNewSession = useCallback(() => {
    if (!getCategory.data?._id) {
      toast.error('Failed to get category')
      return
    }
    const parentFolderId = folder ? folder._id : undefined
    if (folder) {
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

  const handleEndCurrentSession = useCallback(() => {
    if (!campaignId) {
      toast.error('Campaign not found')
      return
    }
    endCurrentSession.mutate({ campaignId })
  }, [campaignId, endCurrentSession])

  const menuItems = useMemo(() => {
    const items: ContextMenuItem[] = []
    
    if (categoryConfig) {
      if (hasActiveSession) {
        items.push({
          type: 'action' as const,
          icon: <Square className="h-4 w-4" />,
          label: 'End Current Session',
          onClick: handleEndCurrentSession,
        })
      } else {
        items.push({
          type: 'action' as const,
          icon: <Play className="h-4 w-4" />,
          label: 'Start New Session',
          onClick: handleStartNewSession,
        })
      }
    }

    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
    }
    // Only show edit category at root level
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
        icon: <SquareArrowOutUpRight className="h-4 w-4" />,
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
    hasActiveSession,
    handleEndCurrentSession,
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

