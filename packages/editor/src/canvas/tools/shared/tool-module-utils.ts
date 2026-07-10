import type { CanvasViewportTools } from '../canvas-tool-types'
import { canvasPointsToScreenPoints } from '../../components/canvas-screen-space-overlay-utils'
import type { CanvasViewport } from '../../types/canvas-domain-types'

export function screenEventToCanvasPosition(
  context: Pick<CanvasViewportTools, 'screenToCanvasPosition'>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
): ReturnType<CanvasViewportTools['screenToCanvasPosition']> {
  return context.screenToCanvasPosition({
    x: event.clientX,
    y: event.clientY,
  })
}

export function setPointerCapture(event: PointerEvent): Element | null {
  if (event.target instanceof Element) {
    try {
      event.target.setPointerCapture(event.pointerId)
      return event.target
    } catch {
      return null
    }
  }

  return null
}

export function releasePointerCapture(target: Element | null, pointerId: number | null) {
  if (!target || pointerId === null) return

  try {
    target.releasePointerCapture(pointerId)
  } catch {
    // releasePointerCapture throws if the pointer is not captured; safe to ignore.
  }
}

export function projectCanvasToolOverlayPoints<TPoint extends { x: number; y: number }>(
  points: ReadonlyArray<TPoint>,
  viewport: CanvasViewport,
): Array<Omit<TPoint, 'x' | 'y'> & { x: number; y: number }> | null {
  if (points.length < 2) return null
  return canvasPointsToScreenPoints(points, viewport)
}
