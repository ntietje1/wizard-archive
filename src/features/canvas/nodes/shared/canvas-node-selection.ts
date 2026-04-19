import { pointInPolygon, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import type { CanvasNodeSelection } from '../canvas-node-module-types'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Node } from '@xyflow/react'

type BoundsLike = { width: number; height: number }

function isBoundsLike(value: unknown): value is BoundsLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'width' in value &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height)
  )
}

function getCanvasNodeBounds(node: Node): Bounds | null {
  const fallbackBounds =
    typeof node.data === 'object' && node.data !== null && 'bounds' in node.data
      ? node.data.bounds
      : null
  const width = node.width ?? (isBoundsLike(fallbackBounds) ? fallbackBounds.width : null)
  const height = node.height ?? (isBoundsLike(fallbackBounds) ? fallbackBounds.height : null)

  if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}

export const rectangularCanvasNodeSelection: CanvasNodeSelection = {
  point: (node, point) => {
    const bounds = getCanvasNodeBounds(node)
    if (!bounds) return false

    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
  },
  rectangle: (node, rect) => {
    const bounds = getCanvasNodeBounds(node)
    return bounds ? rectIntersectsBounds(rect, bounds) : false
  },
  lasso: (node, polygon) => {
    const bounds = getCanvasNodeBounds(node)
    if (!bounds) return false

    const corners: Array<Point2D> = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ]

    return corners.every((corner) => pointInPolygon(corner.x, corner.y, polygon))
  },
}
