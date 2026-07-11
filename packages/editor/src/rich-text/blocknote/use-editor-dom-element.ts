import { useEffect, useRef, useState } from 'react'

type BlockNoteDomElementSource = {
  domElement?: HTMLElement | null
}

const MAX_DOM_ELEMENT_RETRY_FRAMES = 10

export function useEditorDomElement(
  editor: BlockNoteDomElementSource | undefined,
): HTMLElement | null {
  const [domElement, setDomElement] = useState<HTMLElement | null>(() => editor?.domElement ?? null)
  const currentEditorRef = useRef(editor)
  if (currentEditorRef.current !== editor) {
    currentEditorRef.current = editor
  }

  useEffect(() => {
    if (!editor) {
      setDomElement(null)
      return
    }

    const el = editor.domElement
    setDomElement(el ?? null)
    if (el) {
      return
    }

    let rafId: number
    let attempts = 0
    const poll = () => {
      const domEl = editor.domElement
      if (domEl) {
        setDomElement(domEl)
      } else if (attempts < MAX_DOM_ELEMENT_RETRY_FRAMES) {
        attempts += 1
        if (attempts === MAX_DOM_ELEMENT_RETRY_FRAMES) {
          setDomElement(null)
          return
        }
        rafId = requestAnimationFrame(poll)
      } else {
        setDomElement(null)
      }
    }
    rafId = requestAnimationFrame(poll)

    return () => cancelAnimationFrame(rafId)
  }, [editor])

  return currentEditorRef.current === editor ? domElement : null
}
