import { FileEdit, Trash2 } from '~/lib/icons'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import type { Note } from 'convex/notes/types'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { toast } from 'sonner'
import { useCallback, useState, forwardRef } from 'react'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'

interface NoteContextMenuProps {
  note: Note
  children: React.ReactNode
}

export const NoteContextMenu = forwardRef<ContextMenuRef, NoteContextMenuProps>(
  ({ note, children }, ref) => {
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
      useState(false)
    const { setRenamingId } = useFileSidebar()
    const { deleteNote } = useNoteActions()

    const handleRenameNote = () => {
      setRenamingId(note._id)
    }

    const handleDeleteNote = () => {
      setConfirmDeleteDialogOpen(true)
    }

    const confirmDeleteNote = useCallback(async () => {
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
          setConfirmDeleteDialogOpen(false)
        })
    }, [deleteNote, note._id, setConfirmDeleteDialogOpen])

    const menuItems: ContextMenuItem[] = [
      {
        type: 'action',
        label: 'Rename',
        icon: <FileEdit className="h-4 w-4" />,
        onClick: handleRenameNote,
      },
      {
        type: 'action',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: handleDeleteNote,
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
          onConfirm={confirmDeleteNote}
          title="Delete Note"
          description="Are you sure you want to delete this note? This action cannot be undone."
          confirmLabel="Delete Note"
          confirmVariant="destructive"
          icon={Trash2}
        />
      </>
    )
  },
)
