import type { CanvasViewportTools } from '../canvas-tool-types'

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
    event.target.setPointerCapture(event.pointerId)
    return event.target
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
