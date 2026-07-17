import { getStroke } from 'perfect-freehand'
import type { CanvasDocumentNode, CanvasStrokeDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import type { CanvasDrawPoint, CanvasPoint } from './interaction-types'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasNodeId } from '../resources/domain-id'
import { canvasNodeBounds } from './canvas-bounds'
import { createCanvasBoundsIndex } from './bounds-index'

const STROKE_OPTIONS = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
}

export function createCanvasEraserCandidateIndex(nodes: ReadonlyArray<CanvasDocumentNode>) {
  const index = createCanvasBoundsIndex(
    nodes.flatMap((node) =>
      node.type === 'stroke' && !node.hidden
        ? [{ bounds: canvasNodeBounds(node), value: node }]
        : [],
    ),
  )
  return {
    erase(
      trail: ReadonlyArray<CanvasPoint>,
      alreadyMarked: ReadonlySet<CanvasNodeId>,
    ): ReadonlySet<CanvasNodeId> {
      const marked = new Set(alreadyMarked)
      if (trail.length < 2) return marked
      const trailBounds = canvasCenterlineBounds(trail)
      const query = index.query(trailBounds)
      for (const node of query) {
        if (marked.has(node.id)) continue
        if (canvasPolylinesIntersect(trail, canvasStrokeDocumentPoints(node))) {
          marked.add(node.id)
        }
      }
      return marked
    },
  }
}

function canvasCenterlineBounds(points: ReadonlyArray<CanvasPoint>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function canvasStrokeBounds(points: ReadonlyArray<CanvasDrawPoint>, size: number) {
  const outline = canvasStrokeOutline(points, size)
  if (outline.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function canvasStrokePath(points: ReadonlyArray<CanvasDrawPoint>, size: number): string {
  const outline = canvasStrokeOutline(points, size)
  const first = outline[0]
  if (!first || outline.length < 2) return ''
  let path = `M ${first[0]} ${first[1]}`
  for (let index = 1; index < outline.length - 1; index += 1) {
    const point = outline[index]!
    const next = outline[index + 1]!
    path += ` Q ${point[0]} ${point[1]}, ${(point[0] + next[0]) / 2} ${(point[1] + next[1]) / 2}`
  }
  const last = outline[outline.length - 1]!
  return `${path} L ${last[0]} ${last[1]} Z`
}

function canvasStrokeOutline(
  points: ReadonlyArray<CanvasDrawPoint>,
  size: number,
): ReadonlyArray<ReadonlyArray<number>> {
  return getStroke(
    points.map(([x, y, pressure]) => [x, y, pressure]),
    { ...STROKE_OPTIONS, size: Math.max(1, size) },
  )
}

export function canvasStrokeDocumentPoints(
  node: CanvasStrokeDocumentNode,
): ReadonlyArray<CanvasPoint> {
  const size = canvasNodeSize(node)
  const scaleX = node.data.bounds.width > 0 ? size.width / node.data.bounds.width : 1
  const scaleY = node.data.bounds.height > 0 ? size.height / node.data.bounds.height : 1
  return node.data.points.map(([x, y]) => ({
    x: node.position.x + (x - node.data.bounds.x) * scaleX,
    y: node.position.y + (y - node.data.bounds.y) * scaleY,
  }))
}

export function canvasStrokeEndpoint(
  node: CanvasStrokeDocumentNode,
  endpoint: 'end' | 'start',
): Readonly<{ handle: 'bottom' | 'left' | 'right' | 'top'; point: CanvasPoint }> | null {
  const points = canvasStrokeDocumentPoints(node)
  const endpointIndex = endpoint === 'start' ? 0 : points.length - 1
  const point = points[endpointIndex]
  if (!point) return null
  if (points.length < 2) {
    return { point, handle: endpoint === 'start' ? 'left' : 'right' }
  }

  const interior = points[endpoint === 'start' ? 1 : points.length - 2]
  const dx = interior.x - point.x
  const dy = interior.y - point.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { point, handle: dx >= 0 ? 'left' : 'right' }
  }
  return { point, handle: dy >= 0 ? 'top' : 'bottom' }
}
