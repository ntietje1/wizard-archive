import { useEffect, useRef } from 'react'
import type { CanvasToolHandlers } from '../../tools/canvas-tool-types'

interface UseCanvasPointerBridgeOptions {
  surfaceRef: React.RefObject<HTMLDivElement | null>
  activeToolHandlers: CanvasToolHandlers
}

export function useCanvasPointerBridge({
  surfaceRef,
  activeToolHandlers,
}: UseCanvasPointerBridgeOptions) {
  const toolHandlersRef = useRef(activeToolHandlers)
  toolHandlersRef.current = activeToolHandlers

  useEffect(() => {
    const surfaceElement = surfaceRef.current
    if (!surfaceElement) return

    const onPointerDown = (event: PointerEvent) => {
      const handlers = toolHandlersRef.current
      if (!handlers.onPointerDown || event.button !== 0) return
      if (
        !event.target ||
        !(event.target instanceof Element) ||
        !event.target.closest('.react-flow')
      ) {
        return
      }

      handlers.onPointerDown(event)
    }

    const onPointerMove = (event: PointerEvent) => {
      toolHandlersRef.current.onPointerMove?.(event)
    }

    const onPointerUp = (event: PointerEvent) => {
      toolHandlersRef.current.onPointerUp?.(event)
    }

    const onPointerCancel = (event: PointerEvent) => {
      toolHandlersRef.current.onPointerCancel?.(event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      toolHandlersRef.current.onKeyDown?.(event)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      toolHandlersRef.current.onKeyUp?.(event)
    }

    surfaceElement.addEventListener('pointerdown', onPointerDown)
    surfaceElement.addEventListener('pointermove', onPointerMove)
    surfaceElement.addEventListener('pointerup', onPointerUp)
    surfaceElement.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      surfaceElement.removeEventListener('pointerdown', onPointerDown)
      surfaceElement.removeEventListener('pointermove', onPointerMove)
      surfaceElement.removeEventListener('pointerup', onPointerUp)
      surfaceElement.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [surfaceRef])
}
