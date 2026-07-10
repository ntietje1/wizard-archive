import { createContext } from 'react'
import type { AnyItem } from '../../workspace/items'
import type { NoteBlockId } from '../document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { CustomBlockNoteEditor } from '../editor-schema'

type BlockNoteContextMenuSurface = 'note-view'

export interface BlockNoteContextMenuEvent {
  position: { x: number; y: number }
  surface: BlockNoteContextMenuSurface
  item?: AnyItem
  note?: NoteItemWithContent
  noteBlockId?: NoteBlockId
  isEditorTextContext?: boolean
  valueInlineId?: string
  valueInlineInstanceId?: string
  valueInlineEditable?: boolean
}

export interface BlockNoteContextMenuContextType {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
  position: { x: number; y: number } | undefined
  note: NoteItemWithContent | undefined
  noteBlockId: NoteBlockId | undefined
  isEditorTextContext: boolean
  valueInlineId: string | undefined
  valueInlineInstanceId: string | undefined
  valueInlineEditable: boolean
  openValueInline: (valueId: string, instanceId: string | undefined) => void
  registerValueInlineEdit: (valueId: string, instanceId: string, edit: () => void) => () => void
  openMenu: (event: BlockNoteContextMenuEvent) => void
}

export const BlockNoteContextMenuContext = createContext<BlockNoteContextMenuContextType | null>(
  null,
)
