import { useEffect } from 'react'
import { useBlockNoteEditor } from '@blocknote/react'
import { useEditorDomElement } from './use-editor-dom-element'
import { removeProseMirrorDropCursors } from './prevent-external-drop-cursors'
import { shouldPreventExternalFileDrop } from './prevent-external-drop-policy'

/**
 * Prevents ProseMirror from intercepting external file drop events. Dragover
 * still reaches ProseMirror so its native drop cursor can render normally.
 * Place this inside BlockNoteView.
 */
export function PreventExternalDrop() {
  const editor = useBlockNoteEditor()
  const domElement = useEditorDomElement(editor)

  useEffect(() => {
    if (!domElement) return

    const stopDrop = (e: DragEvent) => {
      if (!shouldPreventExternalFileDrop(e)) return

      removeProseMirrorDropCursors(domElement)
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    domElement.addEventListener('drop', stopDrop, true)
    return () => {
      domElement.removeEventListener('drop', stopDrop, true)
    }
  }, [domElement])

  return null
}
