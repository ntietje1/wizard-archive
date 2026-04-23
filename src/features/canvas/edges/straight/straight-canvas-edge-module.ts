import { StraightCanvasEdge } from './straight-canvas-edge'
import {
  getStraightCanvasEdgeBounds,
  straightCanvasEdgeContainsPoint,
  straightCanvasEdgeIntersectsPolygon,
  straightCanvasEdgeIntersectsRectangle,
} from './straight-canvas-edge-geometry'
import { getCanvasStrokeEdgeProperties } from '../shared/canvas-edge-properties'
import type { CanvasEdgeModule } from '../canvas-edge-module-types'

export const straightCanvasEdgeModule: CanvasEdgeModule<'straight'> = {
  type: 'straight',
  EdgeComponent: StraightCanvasEdge,
  properties: ({ edge, updateEdge }) => getCanvasStrokeEdgeProperties(edge, updateEdge),
  selection: {
    getBounds: (edge, context) => getStraightCanvasEdgeBounds(edge, context.nodesById),
    point: (edge, point, context) =>
      straightCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    rectangle: (edge, rect, context) =>
      straightCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    lasso: (edge, polygon, context) =>
      straightCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
  },
}
