import type { Id } from 'convex/_generated/dataModel'
import type { Note } from 'convex/notes/types'
import { Grid2x2Plus } from 'lucide-react'
import { useState, forwardRef } from 'react'
import { toast } from 'sonner'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/base/context-menu'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useFolderState } from '~/hooks/useFolderState'
import { useNoteActions } from '~/hooks/useNoteActions'
import { FilePlus, FolderPlus, FolderEdit, Trash2 } from '~/lib/icons'

interface FolderContextMenuProps {
  folder: Note
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
  const { createPage } = useNoteActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  if (!campaignId) return children

  const handleRenameFolder = () => {
    setRenamingId(folder._id)
  }

  const handleNewPage = async () => {
    await createPage
      .mutateAsync({ noteId: folder._id, title: 'New Page', type: 'text' })
      .then(() => {
        openFolder()
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create page')
      })
  }

  const handleNewFolder = async () => {
    await createFolder
      .mutateAsync({ parentId: folder._id, campaignId: campaignId })
      .then((folderId: Id<'notes'>) => {
        openFolder()
        setRenamingId(folderId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create folder')
      })
  }

  const handleNewCanvas = () => {
    toast.error('Not implemented')
  }

  const handleDeleteFolder = () => {
    setConfirmDeleteDialogOpen(true)
  }

  const menuItems: ContextMenuItem[] = [
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
      label: 'New Canvas',
      icon: <Grid2x2Plus className="h-4 w-4" />,
      onClick: handleNewCanvas,
    },
    {
      type: 'divider',
    },
    {
      type: 'action',
      label: 'Rename',
      icon: <FolderEdit className="h-4 w-4" />,
      onClick: handleRenameFolder,
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
