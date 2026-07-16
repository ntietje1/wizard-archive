import type { CanvasDocumentNode, CanvasStrokeDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import type { CanvasDrawPoint, CanvasPoint } from './interaction-controller'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasNodeId } from '../resources/domain-id'

export function findCanvasStrokesIntersectingTrail(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  trail: ReadonlyArray<CanvasPoint>,
  alreadyMarked: ReadonlySet<CanvasNodeId> = new Set(),
): ReadonlySet<CanvasNodeId> {
  const marked = new Set(alreadyMarked)
  if (trail.length < 2) return marked
  for (const node of nodes) {
    if (
      node.type === 'stroke' &&
      !node.hidden &&
      !marked.has(node.id) &&
      canvasPolylinesIntersect(trail, canvasStrokeDocumentPoints(node))
    ) {
      marked.add(node.id)
    }
  }
  return marked
}

export function canvasStrokeBounds(points: ReadonlyArray<CanvasDrawPoint>, size: number) {
  const radius = size / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x - radius)
    minY = Math.min(minY, y - radius)
    maxX = Math.max(maxX, x + radius)
    maxY = Math.max(maxY, y + radius)
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function canvasStrokeLocalPoints(
  node: CanvasStrokeDocumentNode,
): ReadonlyArray<CanvasPoint> {
  const size = canvasNodeSize(node)
  const scaleX = node.data.bounds.width > 0 ? size.width / node.data.bounds.width : 1
  const scaleY = node.data.bounds.height > 0 ? size.height / node.data.bounds.height : 1
  return node.data.points.map(([x, y]) => ({
    x: (x - node.data.bounds.x) * scaleX,
    y: (y - node.data.bounds.y) * scaleY,
  }))
}

export function canvasStrokeDocumentPoints(
  node: CanvasStrokeDocumentNode,
): ReadonlyArray<CanvasPoint> {
  return canvasStrokeLocalPoints(node).map(({ x, y }) => ({
    x: x + node.position.x,
    y: y + node.position.y,
  }))
}
