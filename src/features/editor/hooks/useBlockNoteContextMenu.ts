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
}

export interface BlockNoteContextMenuContextType {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
  blockNoteId: BlockNoteId | undefined
  setBlockNoteId: (blockNoteId: BlockNoteId | undefined) => void
}

export const BlockNoteContextMenuContext = createContext<BlockNoteContextMenuContextType | null>(
  null,
)

export function useBlockNoteContextMenu(): BlockNoteContextMenuContextType {
  const context = useContext(BlockNoteContextMenuContext)
  if (!context) {
    throw new Error('useBlockNoteContextMenu must be used within a BlockNoteContextMenuProvider')
  }
  return context
}

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
