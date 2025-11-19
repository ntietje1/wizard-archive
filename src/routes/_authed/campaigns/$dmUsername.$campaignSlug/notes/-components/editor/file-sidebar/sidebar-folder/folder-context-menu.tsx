import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/notes/types'
import { useState, forwardRef } from 'react'
import { toast } from 'sonner'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useFolderState } from '~/hooks/useFolderState'
import { useNoteActions } from '~/hooks/useNoteActions'
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
  const { createFolder } = useFolderActions()
  const { openFolder } = useFolderState(folder._id)
  const { createNote } = useNoteActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

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

  const handleDeleteFolder = () => {
    setConfirmDeleteDialogOpen(true)
  }

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
      <FolderDeleteConfirmDialog
        folder={folder}
        isDeleting={confirmDeleteDialogOpen}
        onClose={() => setConfirmDeleteDialogOpen(false)}
      />
    </>
  )
})
