import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { X, MoreVertical, Trash2 } from '~/lib/icons'
import { useCallback, useState, useEffect, useRef } from 'react'
import { UNTITLED_NOTE_TITLE } from 'convex/notes/types'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { toast } from 'sonner'

export function FileTopbar() {
  const { note, selectNote, noteSlug } = useCurrentNote()
  const { updateNote } = useNoteActions()
  const [title, setTitle] = useState(note.data?.name ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(note.data?.name ?? '')
  }, [note.data?.name])

  const handleTitleSubmit = useCallback(async () => {
    if (!note.data) {
      setIsEditing(false)
      return
    }

    const previousTitle = note.data.name ?? ''

    if (title === previousTitle) {
      setIsEditing(false)
      return
    }

    try {
      await updateNote.mutateAsync({ noteId: note.data._id, name: title })
    } catch (error) {
      console.error(error)
      toast.error('Failed to update note')
      setTitle(previousTitle)
    } finally {
      setIsEditing(false)
    }
  }, [note, title, updateNote])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDeleteSuccess = useCallback(() => {
    selectNote(null)
  }, [selectNote])

  if (noteSlug && note.status === 'pending') {
    return <TopbarLoading />
  }

  if (!note.data) {
    return <TopbarEmpty />
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full">
      <div className="flex items-center justify-between w-full">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            placeholder={UNTITLED_NOTE_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTitleSubmit()
              }
            }}
            className="bg-transparent border-b border-transparent outline-none focus:ring-0 px-2 w-full"
            autoFocus
          />
        ) : (
          <div className="truncate">
            <button
              onClick={() => setIsEditing(true)}
              className="text-left border-b border-transparent hover:border-gray-300 px-2 max-w-full truncate"
            >
              {title || (
                <span className="opacity-85">{UNTITLED_NOTE_TITLE}</span>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsDeleting(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => selectNote(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {note.data && (
        <NoteDeleteConfirmDialog
          note={note.data}
          isDeleting={isDeleting}
          onClose={() => setIsDeleting(false)}
          onConfirm={handleDeleteSuccess}
        />
      )}
    </div>
  )
}

function TopbarLoading() {
  return (
    <div className="border-b p-2 h-12">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}

function TopbarEmpty() {
  return (
    <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full">
      <div className="flex items-center justify-between w-full h-12" />
    </div>
  )
}
