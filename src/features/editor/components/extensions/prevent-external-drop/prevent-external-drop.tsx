import { useEffect } from 'react'
import { useBlockNoteEditor } from '@blocknote/react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'

/**
 * Prevents ProseMirror from intercepting external file drag-and-drop events.
 * Without this, ProseMirror's built-in drop handler swallows file drags,
 * breaking the app-level pragmatic-dnd file upload flow.
 * Place this inside BlockNoteView.
 */
export function PreventExternalDrop() {
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const domElement = useEditorDomElement(editor)

  useEffect(() => {
    if (!domElement) return

    const isFileDrag = (e: DragEvent) =>
      e.dataTransfer?.types.includes('Files') ?? false

    const stop = (e: DragEvent) => {
      if (isFileDrag(e)) e.stopPropagation()
    }

    domElement.addEventListener('dragover', stop, true)
    domElement.addEventListener('drop', stop, true)
    return () => {
      domElement.removeEventListener('dragover', stop, true)
      domElement.removeEventListener('drop', stop, true)
    }
  }, [domElement])

  return null
}
