import getStroke from 'perfect-freehand'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type {
  CanvasHandlePosition,
  CanvasNode as Node,
  CanvasPosition as XYPosition,
} from '~/features/canvas/types/canvas-domain-types'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'

export type StrokeNodeData = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: Bounds
}

type StrokeNodeType = Node<StrokeNodeData, 'stroke'>

type StrokeNodeLike = {
  position: XYPosition
  data: {
    points: Array<[number, number, number]>
    size: number
    bounds: Bounds
  }
}

type StrokeEndpoint = 'start' | 'end'

const STROKE_OPTIONS_BASE = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
}

const MIN_STROKE_NODE_SIZE = 1

export function clampStrokeNodeSize(size: number): number {
  return Number.isFinite(size) ? Math.max(size, MIN_STROKE_NODE_SIZE) : MIN_STROKE_NODE_SIZE
}

export function normalizeStrokeNodeData(data: StrokeNodeData): StrokeNodeData {
  return {
    ...data,
    size: clampStrokeNodeSize(data.size),
  }
}

export function isStrokeNode(node: Node): node is StrokeNodeType {
  return node.type === 'stroke'
}

export function pointsToPathD(points: Array<[number, number, number]>, size: number): string {
  const outline = getStroke(points, { ...STROKE_OPTIONS_BASE, size: clampStrokeNodeSize(size) })
  if (outline.length < 2) return ''

  const [first, ...rest] = outline
  let d = `M ${first[0]} ${first[1]}`

  for (let i = 0; i < rest.length - 1; i++) {
    const curr = rest[i]
    const next = rest[i + 1]
    const mx = (curr[0] + next[0]) / 2
    const my = (curr[1] + next[1]) / 2
    d += ` Q ${curr[0]} ${curr[1]}, ${mx} ${my}`
  }

  const last = rest[rest.length - 1]
  d += ` L ${last[0]} ${last[1]} Z`
  return d
}

export function pointsToCenterlinePathD(points: Array<[number, number, number]>): string {
  if (points.length < 2) return ''

  const [first, ...rest] = points
  const segments = [`M ${first[0]} ${first[1]}`]

  for (const [x, y] of rest) {
    segments.push(`L ${x} ${y}`)
  }

  return segments.join(' ')
}

export function getStrokeBounds(
  points: Array<[number, number, number]>,
  size: number,
  precomputedOutline?: Array<Array<number>>,
): Bounds {
  const outline =
    precomputedOutline ??
    getStroke(points, { ...STROKE_OPTIONS_BASE, size: clampStrokeNodeSize(size) })
  if (outline.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [px, py] of outline) {
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function getAbsoluteStrokePoints(
  points: Array<[number, number, number]>,
  bounds: Bounds,
  position: XYPosition,
): Array<[number, number, number]> {
  const offsetX = position.x - bounds.x
  const offsetY = position.y - bounds.y
  return points.map(
    ([x, y, pressure]) => [x + offsetX, y + offsetY, pressure] as [number, number, number],
  )
}

export function getAbsoluteStrokePointsForNode(node: StrokeNodeLike) {
  return getAbsoluteStrokePoints(node.data.points, node.data.bounds, node.position)
}

type AbsoluteStrokePoint = [number, number, number]

function getStrokeEndpointPair(
  endpoint: StrokeEndpoint,
  absolutePoints: ReadonlyArray<AbsoluteStrokePoint>,
) {
  return endpoint === 'start'
    ? { endpointPoint: absolutePoints[0], interiorPoint: absolutePoints[1] }
    : {
        endpointPoint: absolutePoints[absolutePoints.length - 1],
        interiorPoint: absolutePoints[absolutePoints.length - 2],
      }
}

export function getStrokeEndpointPoint(
  node: StrokeNodeLike,
  endpoint: StrokeEndpoint,
  absolutePoints: ReadonlyArray<AbsoluteStrokePoint> = getAbsoluteStrokePointsForNode(node),
): Point2D | null {
  if (absolutePoints.length === 0) {
    return null
  }

  const { endpointPoint } = getStrokeEndpointPair(endpoint, absolutePoints)
  const [x, y] = endpointPoint

  return { x, y }
}

export function getStrokeEndpointConnectionPosition(
  node: StrokeNodeLike,
  endpoint: StrokeEndpoint,
  absolutePoints: ReadonlyArray<AbsoluteStrokePoint> = getAbsoluteStrokePointsForNode(node),
): CanvasHandlePosition {
  if (absolutePoints.length < 2) {
    return endpoint === 'start' ? CANVAS_HANDLE_POSITION.Left : CANVAS_HANDLE_POSITION.Right
  }

  const { endpointPoint, interiorPoint } = getStrokeEndpointPair(endpoint, absolutePoints)
  const dx = interiorPoint[0] - endpointPoint[0]
  const dy = interiorPoint[1] - endpointPoint[1]

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? CANVAS_HANDLE_POSITION.Left : CANVAS_HANDLE_POSITION.Right
  }

  return dy >= 0 ? CANVAS_HANDLE_POSITION.Top : CANVAS_HANDLE_POSITION.Bottom
}

export function resizeStrokeNode<TNode extends StrokeNodeLike>(
  node: TNode,
  {
    width,
    height,
    position,
  }: {
    width: number
    height: number
    position: XYPosition
  },
): TNode {
  const { bounds, points, size } = node.data
  const safeBoundsWidth = Math.max(bounds.width, 1)
  const safeBoundsHeight = Math.max(bounds.height, 1)
  const scaleX = width / safeBoundsWidth
  const scaleY = height / safeBoundsHeight
  const scaledPoints = points.map(
    ([x, y, pressure]) =>
      [bounds.x + (x - bounds.x) * scaleX, bounds.y + (y - bounds.y) * scaleY, pressure] as [
        number,
        number,
        number,
      ],
  )

  return {
    ...node,
    width,
    height,
    position,
    data: {
      ...node.data,
      points: scaledPoints,
      bounds: { ...bounds, width, height },
      size: clampStrokeNodeSize(size * Math.min(scaleX, scaleY)),
    },
  }
}
