import { useEffect, useRef } from 'react'
import type { CanvasToolController } from '../tools/canvas-tool-types'

interface UseCanvasPointerBridgeOptions {
  surfaceRef: React.RefObject<HTMLDivElement | null>
  activeToolController: CanvasToolController
}

export function useCanvasPointerBridge({
  surfaceRef,
  activeToolController,
}: UseCanvasPointerBridgeOptions) {
  const toolControllerRef = useRef(activeToolController)
  toolControllerRef.current = activeToolController

  useEffect(() => {
    const surfaceElement = surfaceRef.current
    if (!surfaceElement) return

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

    surfaceElement.addEventListener('pointerdown', onPointerDown)
    surfaceElement.addEventListener('pointermove', onPointerMove)
    surfaceElement.addEventListener('pointerup', onPointerUp)
    surfaceElement.addEventListener('pointercancel', onPointerCancel)

    return () => {
      surfaceElement.removeEventListener('pointerdown', onPointerDown)
      surfaceElement.removeEventListener('pointermove', onPointerMove)
      surfaceElement.removeEventListener('pointerup', onPointerUp)
      surfaceElement.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [surfaceRef])
}
