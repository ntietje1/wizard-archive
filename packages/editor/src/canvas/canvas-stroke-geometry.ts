import type { CanvasStrokeDocumentNode } from './document-contract'
import type { CanvasPoint } from './interaction-controller'

export function canvasStrokeLocalPoints(
  node: CanvasStrokeDocumentNode,
): ReadonlyArray<CanvasPoint> {
  return node.data.points.map(([x, y]) => ({
    x: x - node.data.bounds.x,
    y: y - node.data.bounds.y,
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
