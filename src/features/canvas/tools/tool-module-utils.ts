import { findCanvasNodeAtPoint } from '../components/nodes/canvas-node-registry'
import type { CanvasViewportTools } from './canvas-tool-types'
import type { Node } from '@xyflow/react'

export function screenEventToFlowPosition(
  context: Pick<CanvasViewportTools, 'screenToFlowPosition'>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
) {
  return context.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
}

export function setPointerCapture(event: PointerEvent) {
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

export function hitTestCanvasNode(
  context: Pick<CanvasViewportTools, 'screenToFlowPosition' | 'getZoom'> & {
    getMeasuredNodes: () => Array<Node>
  },
  event: React.MouseEvent,
): string | null {
  return findCanvasNodeAtPoint(
    context.getMeasuredNodes(),
    screenEventToFlowPosition(context, event),
    {
      zoom: context.getZoom(),
    },
  )
}
