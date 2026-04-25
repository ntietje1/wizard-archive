import {
  DEFAULT_CANVAS_EDGE_STROKE,
  readCanvasEdgeOpacityPercent,
  readCanvasEdgeStroke,
  readCanvasEdgeStrokeWidth,
} from './canvas-edge-style'
import {
  linePaintCanvasProperty,
  strokeSizeCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import type { CanvasEdgePatch, CanvasRuntimeEdge } from '../canvas-edge-types'
import type { CanvasInspectableProperties } from '../../properties/canvas-property-types'

function normalizeOpacityPercent(opacity: number) {
  const clampedOpacity = Math.max(0, Math.min(100, opacity))
  return clampedOpacity >= 100 ? undefined : clampedOpacity / 100
}

function validateStroke(stroke: string) {
  return typeof stroke === 'string' && stroke.length > 0 ? stroke : DEFAULT_CANVAS_EDGE_STROKE
}

export function getCanvasStrokeEdgeProperties(
  edge: CanvasRuntimeEdge,
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
): CanvasInspectableProperties {
  return {
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => readCanvasEdgeStroke(edge.style),
        setValue: ({ color: stroke, opacity }) =>
          patchEdge(edge.id, {
            style: {
              stroke: validateStroke(stroke),
              opacity: normalizeOpacityPercent(opacity),
            },
          }),
        setColor: (stroke) =>
          patchEdge(edge.id, {
            style: {
              stroke: validateStroke(stroke),
            },
          }),
        getOpacity: () => readCanvasEdgeOpacityPercent(edge.style),
        setOpacity: (opacity) =>
          patchEdge(edge.id, {
            style: {
              opacity: normalizeOpacityPercent(opacity),
            },
          }),
      }),
      bindCanvasStrokeSizeProperty(
        strokeSizeCanvasProperty,
        () => readCanvasEdgeStrokeWidth(edge.style),
        (strokeWidth) =>
          patchEdge(edge.id, {
            style: {
              strokeWidth,
            },
          }),
      ),
    ],
  }
}
