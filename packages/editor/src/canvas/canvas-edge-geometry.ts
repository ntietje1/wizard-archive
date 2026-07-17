import type { CanvasDocumentEdge, CanvasDocumentNode, CanvasEdgeType } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import type {
  CanvasConnectionAnchor,
  CanvasConnectionHandle,
  CanvasPoint,
} from './interaction-types'
import type { CanvasNodeId } from '../resources/domain-id'
import { createCanvasBoundsIndex } from './bounds-index'
import type { CanvasBounds } from './canvas-bounds'
import { resolveCanvasEdgeStyle } from './canvas-edge-style'

const BEZIER_SEGMENTS = 16
export const CANVAS_EDGE_HIT_STROKE_WIDTH = 20

export const CANVAS_CONNECTION_HANDLES: ReadonlyArray<CanvasConnectionHandle> = [
  'top',
  'right',
  'bottom',
  'left',
]

export function createCanvasConnectionCandidateIndex(nodes: ReadonlyArray<CanvasDocumentNode>) {
  const candidates = nodes.flatMap((node) =>
    node.hidden
      ? []
      : CANVAS_CONNECTION_HANDLES.map((handle) => ({
          anchor: { nodeId: node.id, handle },
          point: canvasNodeHandlePoint(node, handle),
        })),
  )
  const index = createCanvasBoundsIndex(
    candidates.map((candidate) => ({
      bounds: { ...candidate.point, width: 0, height: 0 },
      value: candidate,
    })),
  )
  return {
    find(
      sourceNodeId: CanvasNodeId,
      point: CanvasPoint,
      radius: number,
    ): CanvasConnectionAnchor | null {
      const nearby = index.query({
        x: point.x - radius,
        y: point.y - radius,
        width: radius * 2,
        height: radius * 2,
      })
      let target: CanvasConnectionAnchor | null = null
      let closestDistance = radius
      for (const candidate of nearby) {
        if (candidate.anchor.nodeId === sourceNodeId) continue
        const distance = Math.hypot(candidate.point.x - point.x, candidate.point.y - point.y)
        if (distance >= closestDistance) continue
        target = candidate.anchor
        closestDistance = distance
      }
      return target
    },
  }
}

export function canvasEdgePath(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): string | null {
  const endpoints = edgeEndpoints(edge, nodesById)
  return endpoints
    ? canvasPathBetween(edge.type, endpoints.source, endpoints.target, endpoints.handles)
    : null
}

export function canvasEdgePolyline(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): ReadonlyArray<CanvasPoint> | null {
  const endpoints = edgeEndpoints(edge, nodesById)
  if (!endpoints) return null
  const { source, target } = endpoints
  if (edge.type === 'straight') return [source, target]
  if (edge.type === 'step') return stepPoints(source, target, endpoints.handles.source)
  const { sourceControl, targetControl } = bezierControls(source, target, endpoints.handles)
  return Array.from({ length: BEZIER_SEGMENTS + 1 }, (_, index) =>
    cubicBezierPoint(source, sourceControl, targetControl, target, index / BEZIER_SEGMENTS),
  )
}

export function canvasEdgeBounds(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): CanvasBounds | null {
  const endpoints = edgeEndpoints(edge, nodesById)
  if (!endpoints) return null
  const points = edgeBoundsPoints(edge.type, endpoints)
  const padding =
    Math.max(CANVAS_EDGE_HIT_STROKE_WIDTH, resolveCanvasEdgeStyle(edge.style).strokeWidth) / 2
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const point of points) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }
  return {
    x: left - padding,
    y: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  }
}

export function canvasConnectionPreviewPath(
  type: CanvasEdgeType,
  source: CanvasConnectionAnchor,
  current: CanvasPoint,
  target: CanvasConnectionAnchor | null,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
): string | null {
  const sourceNode = nodesById.get(source.nodeId)
  if (!sourceNode) return null
  const sourcePoint = canvasNodeHandlePoint(sourceNode, source.handle)
  const targetNode = target ? nodesById.get(target.nodeId) : null
  const targetPoint =
    target && targetNode ? canvasNodeHandlePoint(targetNode, target.handle) : current
  return canvasPathBetween(type, sourcePoint, targetPoint, {
    source: source.handle,
    target: target?.handle ?? oppositeHandle(source.handle),
  })
}

export function canvasNodeHandlePoint(
  node: CanvasDocumentNode,
  handle: CanvasConnectionHandle,
): CanvasPoint {
  const size = canvasNodeSize(node)
  switch (handle) {
    case 'top':
      return { x: node.position.x + size.width / 2, y: node.position.y }
    case 'right':
      return { x: node.position.x + size.width, y: node.position.y + size.height / 2 }
    case 'bottom':
      return { x: node.position.x + size.width / 2, y: node.position.y + size.height }
    case 'left':
      return { x: node.position.x, y: node.position.y + size.height / 2 }
  }
}

function edgeEndpoints(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>,
) {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  if (!sourceNode || !targetNode) return null
  const sourceHandle = parseConnectionHandle(edge.sourceHandle)
  const targetHandle = parseConnectionHandle(edge.targetHandle)
  return {
    source: sourceHandle ? canvasNodeHandlePoint(sourceNode, sourceHandle) : nodeCenter(sourceNode),
    target: targetHandle ? canvasNodeHandlePoint(targetNode, targetHandle) : nodeCenter(targetNode),
    handles: { source: sourceHandle, target: targetHandle },
  }
}

function canvasPathBetween(
  type: CanvasEdgeType,
  source: CanvasPoint,
  target: CanvasPoint,
  handles: Readonly<{
    source: CanvasConnectionHandle | null
    target: CanvasConnectionHandle | null
  }>,
): string {
  if (type === 'straight') return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  if (type === 'step') {
    return stepPoints(source, target, handles.source)
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')
  }
  const { sourceControl, targetControl } = bezierControls(source, target, handles)
  return `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${target.x} ${target.y}`
}

function edgeBoundsPoints(
  type: CanvasEdgeType,
  endpoints: NonNullable<ReturnType<typeof edgeEndpoints>>,
): ReadonlyArray<CanvasPoint> {
  if (type === 'straight') return [endpoints.source, endpoints.target]
  if (type === 'step') {
    return stepPoints(endpoints.source, endpoints.target, endpoints.handles.source)
  }
  const controls = bezierControls(endpoints.source, endpoints.target, endpoints.handles)
  return [endpoints.source, controls.sourceControl, controls.targetControl, endpoints.target]
}

function stepPoints(
  source: CanvasPoint,
  target: CanvasPoint,
  sourceHandle: CanvasConnectionHandle | null,
): ReadonlyArray<CanvasPoint> {
  if (sourceHandle === 'top' || sourceHandle === 'bottom') {
    const middleY = (source.y + target.y) / 2
    return [source, { x: source.x, y: middleY }, { x: target.x, y: middleY }, target]
  }
  const middleX = (source.x + target.x) / 2
  return [source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target]
}

function nodeCenter(node: CanvasDocumentNode): CanvasPoint {
  const size = canvasNodeSize(node)
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 }
}

function bezierControls(
  source: CanvasPoint,
  target: CanvasPoint,
  handles: Readonly<{
    source: CanvasConnectionHandle | null
    target: CanvasConnectionHandle | null
  }>,
) {
  const offset = Math.max(40, Math.hypot(target.x - source.x, target.y - source.y) / 2)
  const sourceDirection = handleDirection(handles.source ?? 'right')
  const targetDirection = handleDirection(handles.target ?? 'left')
  return {
    sourceControl: {
      x: source.x + sourceDirection.x * offset,
      y: source.y + sourceDirection.y * offset,
    },
    targetControl: {
      x: target.x + targetDirection.x * offset,
      y: target.y + targetDirection.y * offset,
    },
  }
}

function handleDirection(handle: CanvasConnectionHandle): CanvasPoint {
  switch (handle) {
    case 'top':
      return { x: 0, y: -1 }
    case 'right':
      return { x: 1, y: 0 }
    case 'bottom':
      return { x: 0, y: 1 }
    case 'left':
      return { x: -1, y: 0 }
  }
}

function oppositeHandle(handle: CanvasConnectionHandle): CanvasConnectionHandle {
  switch (handle) {
    case 'top':
      return 'bottom'
    case 'right':
      return 'left'
    case 'bottom':
      return 'top'
    case 'left':
      return 'right'
  }
}

function parseConnectionHandle(value: string | null | undefined): CanvasConnectionHandle | null {
  return CANVAS_CONNECTION_HANDLES.find((handle) => handle === value) ?? null
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
