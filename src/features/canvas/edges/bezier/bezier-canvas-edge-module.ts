import { BezierCanvasEdge } from './bezier-canvas-edge'
import {
  bezierCanvasEdgeContainsPoint,
  bezierCanvasEdgeIntersectsPolygon,
  bezierCanvasEdgeIntersectsRectangle,
  getBezierCanvasEdgeBounds,
} from './bezier-canvas-edge-geometry'
import type { CanvasEdgeModule } from '../canvas-edge-module-types'

export const bezierCanvasEdgeModule: CanvasEdgeModule<'bezier'> = {
  type: 'bezier',
  EdgeComponent: BezierCanvasEdge,
  selection: {
    getBounds: (edge, context) => getBezierCanvasEdgeBounds(edge, context.nodesById),
    point: (edge, point, context) =>
      bezierCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    rectangle: (edge, rect, context) =>
      bezierCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    lasso: (edge, polygon, context) =>
      bezierCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
  },
}
