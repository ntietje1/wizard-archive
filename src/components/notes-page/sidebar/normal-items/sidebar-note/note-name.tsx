import { UNTITLED_NOTE_TITLE } from 'convex/notes/types'
import type { Note } from 'convex/notes/types'
import { useNoteActions } from '~/hooks/useNoteActions'
import { EditableItemName } from '../../sidebar-item/editable-item-name'

interface NoteNameProps {
  note: Note
}

export function NoteName({ note }: NoteNameProps) {
  const { updateNote } = useNoteActions()

  return (
    <EditableItemName
      item={note}
      defaultName={UNTITLED_NOTE_TITLE}
      updateItem={(id, name) => updateNote.mutateAsync({ noteId: id, name })}
    />
  )
}
