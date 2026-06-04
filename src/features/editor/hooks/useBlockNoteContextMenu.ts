import { createContext } from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { ViewContext } from '~/features/context-menu/types'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'

export interface BlockNoteContextMenuEvent {
  position: { x: number; y: number }
  viewContext: ViewContext
  item?: AnySidebarItem
  note?: NoteWithContent
  blockNoteId?: BlockNoteId
  valueInlineId?: string
  valueInlineInstanceId?: string
  valueInlineEditable?: boolean
}

export interface BlockNoteContextMenuContextType {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
  position: { x: number; y: number } | undefined
  note: NoteWithContent | undefined
  blockNoteId: BlockNoteId | undefined
  valueInlineId: string | undefined
  valueInlineInstanceId: string | undefined
  valueInlineEditable: boolean
  openValueInline: (valueId: string, instanceId: string | undefined) => void
  registerValueInlineEdit: (valueId: string, instanceId: string, edit: () => void) => () => void
}

export const BlockNoteContextMenuContext = createContext<BlockNoteContextMenuContextType | null>(
  null,
)

export function openBlockNoteContextMenu(event: BlockNoteContextMenuEvent) {
  window.dispatchEvent(
    new CustomEvent('blocknote-context-menu', {
      detail: event,
    }),
  )
}
