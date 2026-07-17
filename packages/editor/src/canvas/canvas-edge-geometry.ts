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
import { canvasStepPoints } from './canvas-step-geometry'
import { canvasStrokeEndpoint } from './canvas-stroke-geometry'

const MIN_BEZIER_SEGMENTS = 24
const MAX_BEZIER_SEGMENTS = 160
const BEZIER_SEGMENT_LENGTH = 32
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
    ? canvasPathBetween(
        edge.type,
        endpoints.source,
        endpoints.target,
        endpoints.handles,
        endpoints.bounds,
      )
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
  if (edge.type === 'step') {
    return canvasStepPoints(
      source,
      target,
      endpoints.handles.source,
      endpoints.handles.target,
      endpoints.bounds,
    )
  }
  const { sourceControl, targetControl } = bezierControls(source, target, endpoints.handles)
  const segments = bezierSegments(source, sourceControl, targetControl, target)
  return Array.from({ length: segments + 1 }, (_, index) =>
    cubicBezierPoint(source, sourceControl, targetControl, target, index / segments),
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
  return canvasPathBetween(
    type,
    sourcePoint,
    targetPoint,
    {
      source: source.handle,
      target: target?.handle ?? oppositeHandle(source.handle),
    },
    targetNode ? { source: nodeBounds(sourceNode), target: nodeBounds(targetNode) } : undefined,
  )
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
  const inferredHandles = inferConnectionHandles(sourceNode, targetNode)
  const source = resolveEdgeEndpoint(sourceNode, edge.sourceHandle, inferredHandles.source)
  const target = resolveEdgeEndpoint(targetNode, edge.targetHandle, inferredHandles.target)
  return {
    source: source.point,
    target: target.point,
    handles: { source: source.handle, target: target.handle },
    bounds: { source: nodeBounds(sourceNode), target: nodeBounds(targetNode) },
  }
}

function resolveEdgeEndpoint(
  node: CanvasDocumentNode,
  handleId: string | null | undefined,
  fallback: CanvasConnectionHandle,
): Readonly<{ handle: CanvasConnectionHandle; point: CanvasPoint }> {
  if (node.type === 'stroke' && (handleId === 'start' || handleId === 'end')) {
    const endpoint = canvasStrokeEndpoint(node, handleId)
    if (endpoint) return endpoint
  }
  const handle = parseConnectionHandle(handleId) ?? fallback
  return { handle, point: canvasNodeHandlePoint(node, handle) }
}

function canvasPathBetween(
  type: CanvasEdgeType,
  source: CanvasPoint,
  target: CanvasPoint,
  handles: Readonly<{
    source: CanvasConnectionHandle | null
    target: CanvasConnectionHandle | null
  }>,
  bounds?: Readonly<{ source: CanvasBounds; target: CanvasBounds }>,
): string {
  if (type === 'straight') return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  if (type === 'step') {
    return canvasStepPoints(
      source,
      target,
      handles.source ?? 'right',
      handles.target ?? 'left',
      bounds,
    )
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
    return canvasStepPoints(
      endpoints.source,
      endpoints.target,
      endpoints.handles.source,
      endpoints.handles.target,
      endpoints.bounds,
    )
  }
  const controls = bezierControls(endpoints.source, endpoints.target, endpoints.handles)
  return [endpoints.source, controls.sourceControl, controls.targetControl, endpoints.target]
}

function nodeCenter(node: CanvasDocumentNode): CanvasPoint {
  const size = canvasNodeSize(node)
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 }
}

function nodeBounds(node: CanvasDocumentNode): CanvasBounds {
  return { ...node.position, ...canvasNodeSize(node) }
}

function inferConnectionHandles(
  sourceNode: CanvasDocumentNode,
  targetNode: CanvasDocumentNode,
): Readonly<{
  source: CanvasConnectionHandle
  target: CanvasConnectionHandle
}> {
  const source = nodeCenter(sourceNode)
  const target = nodeCenter(targetNode)
  const dx = target.x - source.x
  const dy = target.y - source.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
  }

  return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' }
}

function bezierControls(
  source: CanvasPoint,
  target: CanvasPoint,
  handles: Readonly<{
    source: CanvasConnectionHandle | null
    target: CanvasConnectionHandle | null
  }>,
) {
  return {
    sourceControl: bezierControlPoint(source, target, handles.source ?? 'right'),
    targetControl: bezierControlPoint(target, source, handles.target ?? 'left'),
  }
}

function bezierControlPoint(
  source: CanvasPoint,
  target: CanvasPoint,
  handle: CanvasConnectionHandle,
): CanvasPoint {
  switch (handle) {
    case 'top':
      return { x: source.x, y: source.y - bezierControlOffset(source.y - target.y) }
    case 'right':
      return { x: source.x + bezierControlOffset(target.x - source.x), y: source.y }
    case 'bottom':
      return { x: source.x, y: source.y + bezierControlOffset(target.y - source.y) }
    case 'left':
      return { x: source.x - bezierControlOffset(source.x - target.x), y: source.y }
  }
}

function bezierControlOffset(distance: number): number {
  return distance >= 0 ? distance / 2 : 0.25 * 25 * Math.sqrt(-distance)
}

function bezierSegments(
  source: CanvasPoint,
  sourceControl: CanvasPoint,
  targetControl: CanvasPoint,
  target: CanvasPoint,
): number {
  const controlPolygonLength =
    pointDistance(source, sourceControl) +
    pointDistance(sourceControl, targetControl) +
    pointDistance(targetControl, target)
  return Math.min(
    MAX_BEZIER_SEGMENTS,
    Math.max(MIN_BEZIER_SEGMENTS, Math.ceil(controlPolygonLength / BEZIER_SEGMENT_LENGTH)),
  )
}

function pointDistance(source: CanvasPoint, target: CanvasPoint): number {
  return Math.hypot(target.x - source.x, target.y - source.y)
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
