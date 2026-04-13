import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { EditorContextMenuRef } from '~/features/context-menu/components/editor-context-menu'
import type { BlockNoteContextMenuEvent } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { BlockNoteContextMenuContext } from '~/features/editor/hooks/useBlockNoteContextMenu'
import type { BlockNoteId } from 'convex/blocks/types'

interface BlockNoteContextMenuProviderProps {
  children: ReactNode
  editor: CustomBlockNoteEditor | null
}

export function BlockNoteContextMenuProvider({
  children,
  editor,
}: BlockNoteContextMenuProviderProps) {
  const [editorOverride, setEditorOverride] = useState<CustomBlockNoteEditor | null>(null)
  const prevEditorRef = useRef(editor)

  if (editor !== prevEditorRef.current) {
    prevEditorRef.current = editor
    setEditorOverride(null)
  }

  const currentEditor = editorOverride ?? editor
  const [currentBlockNoteId, setCurrentBlockNoteId] = useState<BlockNoteId | undefined>(undefined)
  const [menuState, setMenuState] = useState<BlockNoteContextMenuEvent | null>(null)
  const contextMenuRef = useRef<EditorContextMenuRef>(null)

  useEffect(() => {
    const handleOpenRequest = (e: CustomEvent<BlockNoteContextMenuEvent>) => {
      setMenuState(e.detail)
      setCurrentBlockNoteId(e.detail.blockNoteId)
      requestAnimationFrame(() => {
        contextMenuRef.current?.open(e.detail.position)
      })
    }

    window.addEventListener('blocknote-context-menu', handleOpenRequest as EventListener)
    return () => {
      window.removeEventListener('blocknote-context-menu', handleOpenRequest as EventListener)
    }
  }, [])

  const handleClose = () => {
    setMenuState(null)
    setCurrentBlockNoteId(undefined)
  }

  return (
    <BlockNoteContextMenuContext.Provider
      value={{
        editor: currentEditor,
        setEditor: setEditorOverride,
        blockNoteId: currentBlockNoteId,
        setBlockNoteId: setCurrentBlockNoteId,
      }}
    >
      {children}
      {menuState &&
        typeof document !== 'undefined' &&
        createPortal(
          <EditorContextMenu
            ref={contextMenuRef}
            viewContext={menuState.viewContext}
            item={menuState.item}
            onClose={handleClose}
            className="!fixed !w-0 !h-0 !overflow-visible"
          />,
          document.body,
        )}
    </BlockNoteContextMenuContext.Provider>
  )
}
