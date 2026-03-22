import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { EditorContextMenuRef } from '~/components/context-menu/components/EditorContextMenu'
import type { BlockNoteContextMenuEvent } from '~/hooks/useBlockNoteContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { BlockNoteContextMenuContext } from '~/hooks/useBlockNoteContextMenu'

interface BlockNoteContextMenuProviderProps {
  children: ReactNode
  editor: CustomBlockNoteEditor | null
}

export function BlockNoteContextMenuProvider({
  children,
  editor,
}: BlockNoteContextMenuProviderProps) {
  const [editorOverride, setEditorOverride] =
    useState<CustomBlockNoteEditor | null>(null)

  useEffect(() => {
    setEditorOverride(null)
  }, [editor])

  const currentEditor = editorOverride ?? editor
  const [currentBlockId, setCurrentBlockId] = useState<string | undefined>(
    undefined,
  )
  const [menuState, setMenuState] = useState<BlockNoteContextMenuEvent | null>(
    null,
  )
  const contextMenuRef = useRef<EditorContextMenuRef>(null)

  useEffect(() => {
    const handleOpenRequest = (e: CustomEvent<BlockNoteContextMenuEvent>) => {
      setMenuState(e.detail)
      setCurrentBlockId(e.detail.blockId)
    }

    window.addEventListener(
      'blocknote-context-menu',
      handleOpenRequest as EventListener,
    )
    return () => {
      window.removeEventListener(
        'blocknote-context-menu',
        handleOpenRequest as EventListener,
      )
    }
  }, [])

  useEffect(() => {
    if (menuState) {
      requestAnimationFrame(() => {
        contextMenuRef.current?.open(menuState.position)
      })
    }
  }, [menuState])

  const handleClose = useCallback(() => {
    setMenuState(null)
    setCurrentBlockId(undefined)
  }, [])

  return (
    <BlockNoteContextMenuContext.Provider
      value={{
        editor: currentEditor,
        setEditor: setEditorOverride,
        blockId: currentBlockId,
        setBlockId: setCurrentBlockId,
      }}
    >
      {children}
      {menuState &&
        createPortal(
          <EditorContextMenu
            ref={contextMenuRef}
            viewContext={menuState.viewContext}
            item={menuState.item}
            children={undefined}
            onClose={handleClose}
            className="!fixed !w-0 !h-0 !overflow-visible"
          />,
          document.body,
        )}
    </BlockNoteContextMenuContext.Provider>
  )
}
