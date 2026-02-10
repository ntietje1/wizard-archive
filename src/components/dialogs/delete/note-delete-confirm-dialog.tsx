import { useCallback } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Note } from 'convex/notes/types'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'

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
  const { deleteItem } = useSidebarItemMutations()
  const handleConfirm = useCallback(async () => {
    try {
      const tx = deleteItem(note)
      if (tx) await tx.isPersisted.promise
      toast.success('Note deleted')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete note')
    } finally {
      onConfirm?.()
      onClose()
    }
  }, [deleteItem, note, onConfirm, onClose])

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
