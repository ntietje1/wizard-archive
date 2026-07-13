import { useEffect, useState } from 'react'

type BlockNoteDomElementSource = {
  domElement?: HTMLElement | null
}

type EditorDomElementState = {
  editor: BlockNoteDomElementSource | undefined
  domElement: HTMLElement | null
}

const MAX_DOM_ELEMENT_RETRY_FRAMES = 10

export function useEditorDomElement(
  editor: BlockNoteDomElementSource | undefined,
): HTMLElement | null {
  const [state, setState] = useState<EditorDomElementState>(() => ({
    editor,
    domElement: editor?.domElement ?? null,
  }))

  useEffect(() => {
    const publish = (domElement: HTMLElement | null) => {
      setState((current) =>
        current.editor === editor && current.domElement === domElement
          ? current
          : { editor, domElement },
      )
    }

    if (!editor) {
      publish(null)
      return
    }

    const domElement = editor.domElement ?? null
    publish(domElement)
    if (domElement) return

    let rafId: number
    let attempts = 0
    const poll = () => {
      const nextDomElement = editor.domElement
      if (nextDomElement) {
        publish(nextDomElement)
      } else {
        attempts += 1
        if (attempts >= MAX_DOM_ELEMENT_RETRY_FRAMES) return
        rafId = requestAnimationFrame(poll)
      }
    }
    rafId = requestAnimationFrame(poll)

    return () => cancelAnimationFrame(rafId)
  }, [editor])

  return state.editor === editor ? state.domElement : (editor?.domElement ?? null)
}
