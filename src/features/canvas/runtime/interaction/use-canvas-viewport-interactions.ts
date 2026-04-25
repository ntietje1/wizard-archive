import { useEffect, useRef } from 'react'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'

const PRIMARY_BUTTON = 0
const MIDDLE_BUTTON = 1

export function useCanvasViewportInteractions({
  canPrimaryPan,
  ref,
  viewportController,
}: {
  canPrimaryPan: () => boolean
  ref: React.RefObject<HTMLDivElement | null>
  viewportController: CanvasViewportController
}) {
  const canPrimaryPanRef = useRef(canPrimaryPan)
  canPrimaryPanRef.current = canPrimaryPan

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleWheel = (event: WheelEvent) => {
      measureCanvasPerformance(
        'canvas.wheel',
        { ctrlKey: event.ctrlKey, shiftKey: event.shiftKey },
        () => {
          viewportController.handleWheel(event)
        },
      )
      if (event.defaultPrevented) {
        event.stopPropagation()
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isCanvasViewportTarget(event.target)) {
        return
      }

      if (
        event.button === MIDDLE_BUTTON ||
        (event.button === PRIMARY_BUTTON && canPrimaryPanRef.current())
      ) {
        viewportController.handlePanPointerDown(event)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    el.addEventListener('pointerdown', handlePointerDown)
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true })
      el.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [ref, viewportController])
}

function isCanvasViewportTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.canvas-scene'))
}
