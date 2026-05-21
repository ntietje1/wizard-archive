import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { EditorContextMenuRef } from '~/features/context-menu/components/editor-context-menu'
import type { BlockNoteContextMenuEvent } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { BlockNoteContextMenuContext } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'

interface BlockNoteContextMenuProviderProps {
  children: ReactNode
}

export function BlockNoteContextMenuProvider({ children }: BlockNoteContextMenuProviderProps) {
  const storeEditor = useNoteEditorStore((s) => s.editor)
  const [editorOverride, setEditorOverride] = useState<CustomBlockNoteEditor | null>(null)
  const prevEditorRef = useRef(storeEditor)

  if (storeEditor !== prevEditorRef.current) {
    prevEditorRef.current = storeEditor
    setEditorOverride(null)
  }

  const currentEditor = editorOverride ?? storeEditor
  const [menuState, setMenuState] = useState<BlockNoteContextMenuEvent | null>(null)
  const contextMenuRef = useRef<EditorContextMenuRef>(null)
  const valueInlineEditorsRef = useRef(new Map<string, Map<string, () => void>>())

  const openValueInline = useCallback((valueId: string, instanceId: string | undefined) => {
    const editorsByInstanceId = valueInlineEditorsRef.current.get(valueId)
    if (!editorsByInstanceId) return
    const edit = instanceId
      ? editorsByInstanceId.get(instanceId)
      : editorsByInstanceId.values().next().value
    edit?.()
  }, [])

  const registerValueInlineEdit = useCallback(
    (valueId: string, instanceId: string, edit: () => void) => {
      let editorsByInstanceId = valueInlineEditorsRef.current.get(valueId)
      if (!editorsByInstanceId) {
        editorsByInstanceId = new Map()
        valueInlineEditorsRef.current.set(valueId, editorsByInstanceId)
      }
      editorsByInstanceId.set(instanceId, edit)
      return () => {
        const currentEditorsByInstanceId = valueInlineEditorsRef.current.get(valueId)
        if (!currentEditorsByInstanceId) return
        if (currentEditorsByInstanceId.get(instanceId) === edit) {
          currentEditorsByInstanceId.delete(instanceId)
        }
        if (currentEditorsByInstanceId.size === 0) {
          valueInlineEditorsRef.current.delete(valueId)
        }
      }
    },
    [],
  )

  useEffect(() => {
    const handleOpenRequest = (e: CustomEvent<BlockNoteContextMenuEvent>) => {
      setMenuState(e.detail)
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
  }

  return (
    <BlockNoteContextMenuContext.Provider
      value={{
        editor: currentEditor,
        setEditor: setEditorOverride,
        blockNoteId: menuState?.blockNoteId,
        valueInlineId: menuState?.valueInlineId,
        valueInlineInstanceId: menuState?.valueInlineInstanceId,
        valueInlineEditable: menuState?.valueInlineEditable === true,
        openValueInline,
        registerValueInlineEdit,
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
