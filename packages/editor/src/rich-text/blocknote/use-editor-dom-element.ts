import { useEffect, useState } from 'react'

type BlockNoteDomElementSource = {
  domElement?: HTMLElement | null
}

const MAX_DOM_ELEMENT_POLL_FRAMES = 10

export function useEditorDomElement(
  editor: BlockNoteDomElementSource | undefined,
): HTMLElement | null {
  const [domElement, setDomElement] = useState<HTMLElement | null>(() => editor?.domElement ?? null)

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
      } else if (attempts < MAX_DOM_ELEMENT_POLL_FRAMES) {
        attempts += 1
        rafId = requestAnimationFrame(poll)
      } else {
        setDomElement(null)
      }
    }
    rafId = requestAnimationFrame(poll)

    return () => cancelAnimationFrame(rafId)
  }, [editor])

  return domElement
}
