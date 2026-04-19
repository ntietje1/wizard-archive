import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasPreview } from '~/features/previews/hooks/use-canvas-preview'
import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'

interface UseCanvasPreviewContainerOptions {
  canvasId: Id<'sidebarItems'>
  doc: Y.Doc
}

export function useCanvasPreviewContainer({ canvasId, doc }: UseCanvasPreviewContainerOptions) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [wrapperElement, setWrapperElement] = useState<HTMLDivElement | null>(null)
  const [canvasContainer, setCanvasContainer] = useState<HTMLElement | null>(null)

  const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node
    setWrapperElement(node)
  }, [])

  useEffect(() => {
    const wrapper = wrapperElement
    if (!wrapper) {
      setCanvasContainer(null)
      return
    }

    const updateCanvasContainer = () => {
      setCanvasContainer((current) => {
        const next = wrapper.querySelector<HTMLElement>('.react-flow')
        return current === next ? current : next
      })
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const scheduleCanvasContainerUpdate = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = null
        updateCanvasContainer()
      }, 16)
    }

    updateCanvasContainer()

    const observer = new MutationObserver(scheduleCanvasContainerUpdate)
    observer.observe(wrapper, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [wrapperElement])

  useCanvasPreview({
    canvasId,
    doc,
    container: canvasContainer,
  })

  return {
    wrapperRef,
    wrapperElement,
    wrapperCallbackRef,
  }
}
