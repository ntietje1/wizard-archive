import { useEffect, useRef } from 'react'

interface CanvasToolController {
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
}

interface UseCanvasPointerBridgeOptions {
  wrapperElement: HTMLDivElement | null
  activeToolController: CanvasToolController
}

export function useCanvasPointerBridge({
  wrapperElement,
  activeToolController,
}: UseCanvasPointerBridgeOptions) {
  const toolControllerRef = useRef(activeToolController)
  toolControllerRef.current = activeToolController

  useEffect(() => {
    if (!wrapperElement) return

    const onPointerDown = (event: PointerEvent) => {
      const controller = toolControllerRef.current
      if (!controller.onPointerDown || event.button !== 0) return
      if (
        !event.target ||
        !(event.target instanceof Element) ||
        !event.target.closest('.react-flow')
      ) {
        return
      }

      controller.onPointerDown(event)
    }

    const onPointerMove = (event: PointerEvent) => {
      toolControllerRef.current.onPointerMove?.(event)
    }

    const onPointerUp = (event: PointerEvent) => {
      toolControllerRef.current.onPointerUp?.(event)
    }

    const onPointerCancel = (event: PointerEvent) => {
      toolControllerRef.current.onPointerCancel?.(event)
    }

    wrapperElement.addEventListener('pointerdown', onPointerDown)
    wrapperElement.addEventListener('pointermove', onPointerMove)
    wrapperElement.addEventListener('pointerup', onPointerUp)
    wrapperElement.addEventListener('pointercancel', onPointerCancel)

    return () => {
      wrapperElement.removeEventListener('pointerdown', onPointerDown)
      wrapperElement.removeEventListener('pointermove', onPointerMove)
      wrapperElement.removeEventListener('pointerup', onPointerUp)
      wrapperElement.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [wrapperElement])
}
