import type { CanvasAwarenessPresenceWriter, CanvasViewportTools } from '../canvas-tool-types'
import { canvasPointsToScreenPoints } from '../../components/canvas-screen-space-overlay-utils'
import { canvasDevLogger } from '../../internal/dev-logger'
import type { CanvasViewport } from '../../types/canvas-domain-types'
import type { CanvasAwarenessNamespace } from '../../utils/canvas-awareness-types'

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

export function writeValidatedPresence<T>({
  writer,
  namespace,
  value,
  parse,
  invalidMessage,
  invalidValue = value,
}: {
  writer: CanvasAwarenessPresenceWriter
  namespace: CanvasAwarenessNamespace
  value: unknown
  parse: (value: unknown) => T | null
  invalidMessage: string
  invalidValue?: unknown
}) {
  if (value === null) {
    writer.setPresence(namespace, null)
    return
  }

  const parsed = parse(value)
  if (!parsed) {
    canvasDevLogger.error(invalidMessage, invalidValue)
    return
  }

  writer.setPresence(namespace, parsed)
}
