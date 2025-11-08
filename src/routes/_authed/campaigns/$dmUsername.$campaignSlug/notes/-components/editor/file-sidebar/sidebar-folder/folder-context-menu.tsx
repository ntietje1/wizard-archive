import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/notes/types'
import { useCallback, useState, forwardRef } from 'react'
import { toast } from 'sonner'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useFolderState } from '~/hooks/useFolderState'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import { FilePlus, FolderPlus, FolderEdit, Trash2 } from '~/lib/icons'

interface FolderContextMenuProps {
  folder: Folder
  children: React.ReactNode
}

export const FolderContextMenu = forwardRef<
  ContextMenuRef,
  FolderContextMenuProps
>(({ folder, children }, ref) => {
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false)
  const { setRenamingId } = useFileSidebar()
  const { deleteFolder, createFolder } = useFolderActions()
  const { openFolder } = useFolderState(folder._id)
  const { createNote } = useNoteActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const sidebarItemsByParent = useSidebarItemsByParent(
    folder.categoryId,
    folder._id,
  )

  const hasDirectChildren =
    folder && (sidebarItemsByParent.data?.length || 0) > 0

  if (!campaignId) return children

  const handleRenameFolder = () => {
    setRenamingId(folder._id)
  }

  const handleNewPage = async () => {
    await createNote
      .mutateAsync({ parentFolderId: folder._id, campaignId: campaignId })
      .then(({ noteId }) => {
        openFolder()
        setRenamingId(noteId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create page')
      })
  }

  const handleNewFolder = async () => {
    await createFolder
      .mutateAsync({ parentFolderId: folder._id, campaignId: campaignId })
      .then((folderId: Id<'folders'>) => {
        openFolder()
        setRenamingId(folderId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create folder')
      })
  }

  const handleDeleteFolder = async () => {
    setConfirmDeleteDialogOpen(true)
  }

  const confirmDeleteFolder = useCallback(async () => {
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
  }, [deleteFolder, folder._id, setConfirmDeleteDialogOpen])

  const menuItems: ContextMenuItem[] = [
    {
      type: 'action',
      label: 'Rename',
      icon: <FolderEdit className="h-4 w-4" />,
      onClick: handleRenameFolder,
    },
    {
      type: 'action',
      label: 'New Page',
      icon: <FilePlus className="h-4 w-4" />,
      onClick: handleNewPage,
    },
    {
      type: 'action',
      label: 'New Folder',
      icon: <FolderPlus className="h-4 w-4" />,
      onClick: handleNewFolder,
    },
    {
      type: 'action',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDeleteFolder,
      className: 'text-red-600 focus:text-red-600',
    },
  ]

  return (
    <>
      <ContextMenu ref={ref} items={menuItems}>
        {children}
      </ContextMenu>
      <ConfirmationDialog
        isOpen={confirmDeleteDialogOpen}
        onClose={() => setConfirmDeleteDialogOpen(false)}
        onConfirm={confirmDeleteFolder}
        title="Delete Folder"
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
    </>
  )
})
