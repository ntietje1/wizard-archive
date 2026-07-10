import type { MouseEvent } from 'react'
import type { NoteBlockId } from '../document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { BlockNoteContextMenuContextType } from './blocknote-context-menu'

export function openNoteBlockContextMenuFromEvent({
  event,
  note,
  noteBlockId,
  openMenu,
}: {
  event: MouseEvent<HTMLElement>
  note: NoteItemWithContent
  noteBlockId?: NoteBlockId
  openMenu: BlockNoteContextMenuContextType['openMenu']
}) {
  event.preventDefault()
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation?.()

  if (!openMenu) {
    throw new Error('Note block context menu requires an openMenu capability')
  }

  openMenu({
    position: { x: event.clientX, y: event.clientY },
    surface: 'note-view',
    note,
    noteBlockId,
  })
}
