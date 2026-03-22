import { createContext, useContext } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { ViewContext } from '~/components/context-menu/types'

export interface BlockNoteContextMenuEvent {
  position: { x: number; y: number }
  viewContext: ViewContext
  item?: AnySidebarItem
  blockId?: string
}

export interface BlockNoteContextMenuContextType {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
  blockId: string | undefined
  setBlockId: (blockId: string | undefined) => void
}

export const BlockNoteContextMenuContext =
  createContext<BlockNoteContextMenuContextType | null>(null)

export function useBlockNoteContextMenu(): BlockNoteContextMenuContextType {
  const context = useContext(BlockNoteContextMenuContext)
  if (!context) {
    throw new Error(
      'useBlockNoteContextMenu must be used within a BlockNoteContextMenuProvider',
    )
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
