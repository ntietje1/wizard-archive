import { useEffect, useState } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

/**
 * Returns editor.domElement, waiting for it to become available.
 *
 * Child effects run before BlockNoteView finishes mounting, so
 * editor.domElement may be null on the first render. This hook
 * polls with requestAnimationFrame until the element is ready,
 * then triggers a re-render so consumers always get a stable value.
 */
export function useEditorDomElement(editor: CustomBlockNoteEditor | undefined): HTMLElement | null {
  const [domElement, setDomElement] = useState<HTMLElement | null>(() => editor?.domElement ?? null)

  useEffect(() => {
    if (!editor) {
      setDomElement(null)
      return
    }

    // Already available (common on re-renders)
    const el = editor.domElement
    if (el) {
      setDomElement(el)
      return
    }

    // Poll until BlockNoteView mounts the DOM
    let rafId: number
    const poll = () => {
      const domEl = editor.domElement
      if (domEl) {
        setDomElement(domEl)
      } else {
        rafId = requestAnimationFrame(poll)
      }
    }
    rafId = requestAnimationFrame(poll)

    return () => cancelAnimationFrame(rafId)
  }, [editor])

  return domElement
}
