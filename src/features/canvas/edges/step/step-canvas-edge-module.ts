import { StepCanvasEdge } from './step-canvas-edge'
import {
  getStepCanvasEdgeBounds,
  stepCanvasEdgeContainsPoint,
  stepCanvasEdgeIntersectsPolygon,
  stepCanvasEdgeIntersectsRectangle,
} from './step-canvas-edge-geometry'
import { getCanvasStrokeEdgeProperties } from '../shared/canvas-edge-properties'
import type { CanvasEdgeModule } from '../canvas-edge-module-types'

export const stepCanvasEdgeModule: CanvasEdgeModule<'step'> = {
  type: 'step',
  EdgeComponent: StepCanvasEdge,
  properties: ({ edge, updateEdge }) => getCanvasStrokeEdgeProperties(edge, updateEdge),
  selection: {
    getBounds: (edge, context) => getStepCanvasEdgeBounds(edge, context.nodesById),
    point: (edge, point, context) =>
      stepCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    rectangle: (edge, rect, context) =>
      stepCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    lasso: (edge, polygon, context) =>
      stepCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
  },
}
