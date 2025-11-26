import { FileEdit, Trash2 } from '~/lib/icons'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/base/context-menu'
import type { Note } from 'convex/notes/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useState, forwardRef } from 'react'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'

interface NoteContextMenuProps {
  note: Note
  children: React.ReactNode
}

export const NoteContextMenu = forwardRef<ContextMenuRef, NoteContextMenuProps>(
  ({ note, children }, ref) => {
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
      useState(false)
    const { setRenamingId } = useFileSidebar()

    const handleRenameNote = () => {
      setRenamingId(note._id)
    }

    const handleDeleteNote = () => {
      setConfirmDeleteDialogOpen(true)
    }

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
        <NoteDeleteConfirmDialog
          note={note}
          isDeleting={confirmDeleteDialogOpen}
          onClose={() => setConfirmDeleteDialogOpen(false)}
        />
      </>
    )
  },
)
