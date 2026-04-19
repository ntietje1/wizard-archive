import getStroke from 'perfect-freehand'
import type { Node, XYPosition } from '@xyflow/react'
import type { Bounds } from '../../utils/canvas-geometry-utils'

export type StrokeNodeData = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: Bounds
}

export type StrokeNodeType = Node<StrokeNodeData, 'stroke'>

type StrokeNodeLike = {
  position: XYPosition
  data: {
    points: Array<[number, number, number]>
    size: number
    bounds: Bounds
  }
}

const STROKE_OPTIONS_BASE = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
}

const MINI_MAP_STROKE_PADDING = 12
const MIN_ZOOM = 1e-6

export function isStrokeNode(node: Node): node is StrokeNodeType {
  return node.type === 'stroke'
}

export function pointsToPathD(points: Array<[number, number, number]>, size: number): string {
  const outline = getStroke(points, { ...STROKE_OPTIONS_BASE, size })
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

export function getStrokeBounds(
  points: Array<[number, number, number]>,
  size: number,
  precomputedOutline?: Array<Array<number>>,
): Bounds {
  const outline = precomputedOutline ?? getStroke(points, { ...STROKE_OPTIONS_BASE, size })
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
      size: size * Math.min(scaleX, scaleY),
    },
  }
}

export function getMiniMapStrokePath(
  points: Array<[number, number, number]>,
  size: number,
  zoom: number,
): string {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return pointsToPathD(points, (size + MINI_MAP_STROKE_PADDING) / safeZoom)
}
