import { getStrokeSelectionPadding, pointHitsStrokeSelection } from '../utils/canvas-stroke-utils'
import type { CanvasDocumentReader, CanvasViewportTools } from './canvas-tool-types'
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

export function hitTestStrokeNode(
  context: CanvasDocumentReader & CanvasViewportTools,
  event: React.MouseEvent,
): string | null {
  const flowPos = screenEventToFlowPosition(context, event)
  const threshold = getStrokeSelectionPadding(context.getZoom())
  const strokeNodes = context.getNodes().filter((node) => node.type === 'stroke')

  for (let i = strokeNodes.length - 1; i >= 0; i--) {
    const node = strokeNodes[i]
    if (!isStrokeNodeWithData(node)) continue

    const bounds = node.data.bounds
    const bboxLeft = node.position.x - threshold
    const bboxRight = node.position.x + bounds.width + threshold
    const bboxTop = node.position.y - threshold
    const bboxBottom = node.position.y + bounds.height + threshold

    if (
      flowPos.x < bboxLeft ||
      flowPos.x > bboxRight ||
      flowPos.y < bboxTop ||
      flowPos.y > bboxBottom
    ) {
      continue
    }

    if (pointHitsStrokeSelection(flowPos, node, context.getZoom())) {
      return node.id
    }
  }

  return null
}

function isStrokeNodeWithData(node: Node): node is Node<
  {
    bounds: { x: number; y: number; width: number; height: number }
    points: Array<[number, number, number]>
    size: number
  },
  'stroke'
> {
  const bounds = node.data?.bounds

  return (
    node.type === 'stroke' &&
    !!node.data &&
    Array.isArray(node.data.points) &&
    isStrokeBounds(bounds) &&
    typeof node.data.size === 'number'
  )
}

function isStrokeBounds(
  bounds: unknown,
): bounds is { x: number; y: number; width: number; height: number } {
  return (
    !!bounds &&
    typeof bounds === 'object' &&
    'x' in bounds &&
    typeof bounds.x === 'number' &&
    'y' in bounds &&
    typeof bounds.y === 'number' &&
    'width' in bounds &&
    typeof bounds.width === 'number' &&
    'height' in bounds &&
    typeof bounds.height === 'number'
  )
}
