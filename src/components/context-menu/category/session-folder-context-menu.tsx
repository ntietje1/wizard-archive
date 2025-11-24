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
import { Play, Square } from 'lucide-react'
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
  const { startNewSession, currentSession, endCurrentSession } = useSession()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const campaignId = campaign?._id

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
    startNewSession({
      categoryId: getCategory.data._id,
      parentFolderId: parentFolderId,
    })
  }, [getCategory.data?._id, folder, startNewSession])

  const handleEndCurrentSession = useCallback(() => {
    if (!campaignId) {
      toast.error('Campaign not found')
      return
    }
    endCurrentSession.mutate({ campaignId })
  }, [campaignId, endCurrentSession])

  const menuItems = useMemo(() => {
    if (!categoryConfig) {
      return []
    }
    const items: ContextMenuItem[] = []
    
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

    if (folder) {
      if (editFolder.menuItem) {
        items.push(editFolder.menuItem)
      }
    } else {
      if (newFolder.menuItem) {
        items.push(newFolder.menuItem)
      }
    }
    return items
  }, [
    folder,
    categoryConfig,
    handleStartNewSession,
    handleEndCurrentSession,
    hasActiveSession,
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
