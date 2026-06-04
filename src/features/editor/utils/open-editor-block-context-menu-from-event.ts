import type { MouseEvent } from 'react'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'

export function openEditorBlockContextMenuFromEvent({
  event,
  note,
  blockNoteId,
}: {
  event: MouseEvent<HTMLElement>
  note: NoteWithContent
  blockNoteId?: BlockNoteId
}) {
  event.preventDefault()
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation?.()

  openBlockNoteContextMenu({
    position: { x: event.clientX, y: event.clientY },
    viewContext: 'note-view',
    note,
    blockNoteId,
  })
}
