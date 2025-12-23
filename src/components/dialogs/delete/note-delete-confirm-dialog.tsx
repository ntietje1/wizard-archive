import { useCallback } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Note } from 'convex/notes/types'
import { useNoteActions } from '~/hooks/useNoteActions'

interface NoteDeleteConfirmDialogProps {
  note: Note
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}
export function NoteDeleteConfirmDialog({
  note,
  isDeleting,
  onConfirm,
  onClose,
}: NoteDeleteConfirmDialogProps) {
  const { deleteNote } = useNoteActions()
  const handleConfirm = useCallback(async () => {
    await deleteNote
      .mutateAsync({ noteId: note._id })
      .then(() => {
        toast.success('Note deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete note')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteNote, note._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Note"
      description="Are you sure you want to delete this note? This action cannot be undone."
      confirmLabel="Delete Note"
      confirmVariant="destructive"
    />
  )
}
