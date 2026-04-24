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

export function getCanvasStrokeEdgeProperties(
  edge: CanvasRuntimeEdge,
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
): CanvasInspectableProperties {
  return {
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => readCanvasEdgeStroke(edge.style),
        setValue: ({ color: stroke, opacity }) => {
          const clampedOpacity = Math.max(0, Math.min(100, opacity))

          patchEdge(edge.id, {
            style: {
              stroke:
                typeof stroke === 'string' && stroke.length > 0
                  ? stroke
                  : DEFAULT_CANVAS_EDGE_STROKE,
              opacity: clampedOpacity >= 100 ? undefined : clampedOpacity / 100,
            },
          })
        },
        setColor: (stroke) =>
          patchEdge(edge.id, {
            style: {
              stroke:
                typeof stroke === 'string' && stroke.length > 0
                  ? stroke
                  : DEFAULT_CANVAS_EDGE_STROKE,
            },
          }),
        getOpacity: () => readCanvasEdgeOpacityPercent(edge.style),
        setOpacity: (opacity) => {
          const clampedOpacity = Math.max(0, Math.min(100, opacity))

          return patchEdge(edge.id, {
            style: {
              opacity: clampedOpacity >= 100 ? undefined : clampedOpacity / 100,
            },
          })
        },
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
