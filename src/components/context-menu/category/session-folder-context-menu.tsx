import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useCallback, useMemo } from 'react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Folder } from 'convex/folders/types'
import {
  useCategoryNewFolderWithDialog,
  useCategoryEditFolder,
} from '~/hooks/useCategoryContextMenu'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import { useFolderActions } from '~/hooks/useFolderActions'
import { toast } from 'sonner'
import { useSession } from '~/hooks/useSession'
import { Play } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useCampaign } from '~/contexts/CampaignContext'

export interface SessionFolderContextMenuProps {
  children: React.ReactNode
  categoryConfig?: TagCategoryConfig
  folder?: Folder
}

export const SessionFolderContextMenu = forwardRef<
  ContextMenuRef,
  SessionFolderContextMenuProps
>(({ children, categoryConfig, folder }, ref) => {
  const newFolder = useCategoryNewFolderWithDialog(categoryConfig, folder)
  const editFolder = useCategoryEditFolder(folder)
  const { updateFolder } = useFolderActions()
  const { startNewSession } = useSession()
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

  const handleStartNewSession = useCallback(() => {
    if (!getCategory.data?._id) {
      toast.error('Failed to get category')
      return
    }
    startNewSession({
      categoryId: getCategory.data._id,
      parentFolderId: folder?._id,
    })
  }, [getCategory.data?._id, folder?._id, startNewSession])

  const menuItems = useMemo(() => {
    if (!categoryConfig) {
      return []
    }
    if (folder) {
      if (!editFolder.menuItem) {
        return []
      }
      return [editFolder.menuItem]
    }
    const items: ContextMenuItem[] = []
    items.push({
      type: 'action' as const,
      icon: <Play className="h-4 w-4" />,
      label: 'Start New Session',
      onClick: handleStartNewSession,
    })

    if (newFolder.menuItem) {
      items.push(newFolder.menuItem)
    }
    return items
  }, [
    folder,
    categoryConfig,
    startNewSession,
    newFolder.menuItem,
    editFolder.menuItem,
  ])

  return (
    <>
      <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
        {children}
      </ContextMenu>

      {categoryConfig && !folder && (
        <>
          <FolderDialog
            isOpen={newFolder.isDialogOpen}
            onClose={() => newFolder.setIsDialogOpen(false)}
            mode="create"
            onSubmit={newFolder.onSubmit}
          />
        </>
      )}

      {folder && (
        <FolderDialog
          isOpen={editFolder.isDialogOpen}
          onClose={() => editFolder.setIsDialogOpen(false)}
          mode="edit"
          folderId={folder._id}
          initialName={folder.name || ''}
          onSubmit={async (values) => {
            try {
              await updateFolder.mutateAsync({
                folderId: folder._id,
                name: values.name,
              })
              editFolder.setIsDialogOpen(false)
              toast.success('Folder updated')
            } catch (error) {
              console.error(error)
              toast.error('Failed to update folder')
            }
          }}
        />
      )}
    </>
  )
})
