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
} from '~/hooks/useCategoryContextMenu'
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
    openFolder()
    startNewSession({
      categoryId: getCategory.data._id,
      parentFolderId: folder?._id,
    })
  }, [
    getCategory.data?._id,
    folder?._id,
    startNewSession,
    openFolder,
  ])

  const menuItems = useMemo(() => {
    const items: ContextMenuItem[] = []
    
    // Only show "Start New Session" when not in a folder context
    if (!folder && categoryConfig) {
      items.push({
        type: 'action' as const,
        icon: <Play className="h-4 w-4" />,
        label: 'Start New Session',
        onClick: handleStartNewSession,
      })
    }

    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
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
    handleStartNewSession,
    newFolder.menuItem,
    renameFolder.menuItem,
    deleteFolder.menuItem,
    navigateToCategory,
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
        </>
      )}
    </>
  )
})

