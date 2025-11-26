import { ConfirmationDialog } from '../confirmation-dialog'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Note } from 'convex/notes/types'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'

interface FolderDeleteConfirmDialogProps {
  folder: Note
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}
export function FolderDeleteConfirmDialog({
  folder,
  isDeleting,
  onConfirm,
  onClose,
}: FolderDeleteConfirmDialogProps) {
  const { deleteNote } = useNoteActions()
  const sidebarItemsByParent = useSidebarItemsByParent(
    folder.categoryId,
    folder._id,
  )
  const hasDirectChildren =
    folder && (sidebarItemsByParent.data?.length || 0) > 0
  const handleConfirm = useCallback(async () => {
    await deleteNote
      .mutateAsync({ noteId: folder._id })
      .then(() => {
        toast.success('Folder deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete folder')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteNote, folder._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Folder"
      description={
        hasDirectChildren ? (
          <p>
            <strong className="text-red-600">This folder isn't empty!</strong>
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
    />
  )
}
