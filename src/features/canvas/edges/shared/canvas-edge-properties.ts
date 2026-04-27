import {
  DEFAULT_CANVAS_EDGE_STROKE,
  clampCanvasEdgeStrokeWidth,
  readCanvasEdgeOpacityPercent,
  readCanvasEdgeStroke,
  readCanvasEdgeStrokeWidth,
} from './canvas-edge-style'
import {
  lineStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import type { CanvasEdgePatch, CanvasRuntimeEdge } from '../canvas-edge-types'
import type { CanvasInspectableProperties } from '../../properties/canvas-property-types'

function normalizeOpacityPercent(opacity: number) {
  if (Number.isNaN(opacity)) {
    return undefined
  }

  const clampedOpacity = Math.max(0, Math.min(100, opacity))
  return clampedOpacity >= 100 ? undefined : clampedOpacity / 100
}

function validateStroke(stroke: string) {
  return typeof stroke === 'string' && stroke.length > 0 ? stroke : DEFAULT_CANVAS_EDGE_STROKE
}

function validateStrokeWidth(strokeWidth: number) {
  if (!Number.isFinite(strokeWidth)) {
    return lineStrokeSizeCanvasProperty.min
  }

  return clampCanvasEdgeStrokeWidth(Math.min(lineStrokeSizeCanvasProperty.max, strokeWidth))
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
        lineStrokeSizeCanvasProperty,
        () => readCanvasEdgeStrokeWidth(edge.style),
        (strokeWidth) =>
          patchEdge(edge.id, {
            style: {
              strokeWidth: validateStrokeWidth(strokeWidth),
            },
          }),
      ),
    ],
  }
}
