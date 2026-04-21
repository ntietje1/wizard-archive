import { polygonIntersectsBounds, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import type { CanvasNodeSelection } from '../canvas-node-module-types'
import { getCanvasNodeBounds } from './canvas-node-bounds'

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
    return polygonIntersectsBounds(polygon, bounds)
  },
}
