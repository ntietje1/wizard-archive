import { useEffect } from 'react'
import { useBlockNoteEditor } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { shouldPreventExternalFileDrop } from './prevent-external-drop-policy'

/**
 * Prevents ProseMirror from intercepting external file drop events. Dragover
 * still reaches ProseMirror so its native drop cursor can render normally.
 * Place this inside BlockNoteView.
 */
export function PreventExternalDrop() {
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const domElement = useEditorDomElement(editor)

  useEffect(() => {
    if (!domElement) return

    const stopDrop = (e: DragEvent) => {
      if (!shouldPreventExternalFileDrop(e)) return

      removeProseMirrorDropCursors(domElement.ownerDocument)
      e.stopPropagation()
    }

    domElement.addEventListener('drop', stopDrop, true)
    return () => {
      domElement.removeEventListener('drop', stopDrop, true)
    }
  }, [domElement])

  return null
}

function removeProseMirrorDropCursors(document: Document) {
  document
    .querySelectorAll('.prosemirror-dropcursor-block, .prosemirror-dropcursor-inline')
    .forEach((element) => element.parentElement?.removeChild(element))
}
