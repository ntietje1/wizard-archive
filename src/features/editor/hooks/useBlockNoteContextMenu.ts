import { createContext, useContext } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { ViewContext } from '~/features/context-menu/types'
import type { BlockNoteId } from 'convex/blocks/types'

export interface BlockNoteContextMenuEvent {
  position: { x: number; y: number }
  viewContext: ViewContext
  item?: AnySidebarItem
  blockNoteId?: BlockNoteId
  valueInlineId?: string
  valueInlineEditable?: boolean
}

export interface BlockNoteContextMenuContextType {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
  blockNoteId: BlockNoteId | undefined
  valueInlineId: string | undefined
  valueInlineEditable: boolean
  openValueInline: (valueId: string) => void
  registerValueInlineEdit: (valueId: string, edit: () => void) => () => void
}

export const BlockNoteContextMenuContext = createContext<BlockNoteContextMenuContextType | null>(
  null,
)

export function useBlockNoteContextMenuOptional(): BlockNoteContextMenuContextType | null {
  return useContext(BlockNoteContextMenuContext)
}

export function openBlockNoteContextMenu(event: BlockNoteContextMenuEvent) {
  window.dispatchEvent(
    new CustomEvent('blocknote-context-menu', {
      detail: event,
    }),
  )
}
