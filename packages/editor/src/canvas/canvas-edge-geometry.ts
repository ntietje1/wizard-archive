import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import type { CanvasPoint } from './interaction-controller'
import type { CanvasNodeId } from '../resources/domain-id'

const BEZIER_SEGMENTS = 16

export function canvasEdgePath(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): string | null {
  const endpoints = edgeEndpoints(edge, nodesById)
  if (!endpoints) return null
  const { source, target } = endpoints
  if (edge.type === 'straight') return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  if (edge.type === 'step') {
    const middleX = (source.x + target.x) / 2
    return `M ${source.x} ${source.y} L ${middleX} ${source.y} L ${middleX} ${target.y} L ${target.x} ${target.y}`
  }
  const { sourceControl, targetControl } = bezierControls(source, target)
  return `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${target.x} ${target.y}`
}

export function canvasEdgePolyline(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): ReadonlyArray<CanvasPoint> | null {
  const endpoints = edgeEndpoints(edge, nodesById)
  if (!endpoints) return null
  const { source, target } = endpoints
  if (edge.type === 'straight') return [source, target]
  if (edge.type === 'step') {
    const middleX = (source.x + target.x) / 2
    return [source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target]
  }
  const { sourceControl, targetControl } = bezierControls(source, target)
  return Array.from({ length: BEZIER_SEGMENTS + 1 }, (_, index) =>
    cubicBezierPoint(source, sourceControl, targetControl, target, index / BEZIER_SEGMENTS),
  )
}

function edgeEndpoints(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
) {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  if (!sourceNode || !targetNode) return null
  return { source: nodeCenter(sourceNode), target: nodeCenter(targetNode) }
}

function nodeCenter(node: CanvasDocumentNode): CanvasPoint {
  const size = canvasNodeSize(node)
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 }
}

function bezierControls(source: CanvasPoint, target: CanvasPoint) {
  const offset = Math.max(40, Math.abs(target.x - source.x) / 2)
  return {
    sourceControl: { x: source.x + offset, y: source.y },
    targetControl: { x: target.x - offset, y: target.y },
  }
}

function cubicBezierPoint(
  start: CanvasPoint,
  startControl: CanvasPoint,
  endControl: CanvasPoint,
  end: CanvasPoint,
  progress: number,
): CanvasPoint {
  const remaining = 1 - progress
  return {
    x:
      remaining ** 3 * start.x +
      3 * remaining ** 2 * progress * startControl.x +
      3 * remaining * progress ** 2 * endControl.x +
      progress ** 3 * end.x,
    y:
      remaining ** 3 * start.y +
      3 * remaining ** 2 * progress * startControl.y +
      3 * remaining * progress ** 2 * endControl.y +
      progress ** 3 * end.y,
  }
}
