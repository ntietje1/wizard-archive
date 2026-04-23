import {
  DEFAULT_CANVAS_EDGE_STROKE,
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
import type { CanvasInspectableProperties } from '../../properties/canvas-property-types'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import type { Edge } from '@xyflow/react'

export function getCanvasStrokeEdgeProperties(
  edge: Edge,
  updateEdge: CanvasDocumentWriter['updateEdge'],
): CanvasInspectableProperties {
  return {
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => readCanvasEdgeStroke(edge.style),
        setColor: (stroke) =>
          updateEdge(edge.id, (currentEdge) => ({
            ...currentEdge,
            style: {
              ...currentEdge.style,
              stroke:
                typeof stroke === 'string' && stroke.length > 0
                  ? stroke
                  : DEFAULT_CANVAS_EDGE_STROKE,
            },
          })),
        getOpacity: () =>
          typeof edge.style?.opacity === 'number'
            ? Math.round(Math.min(1, Math.max(0, edge.style.opacity)) * 100)
            : 100,
        setOpacity: (opacity) => {
          const clampedOpacity = Math.max(0, Math.min(100, opacity))

          return updateEdge(edge.id, (currentEdge) => ({
            ...currentEdge,
            style: {
              ...currentEdge.style,
              opacity: clampedOpacity >= 100 ? undefined : clampedOpacity / 100,
            },
          }))
        },
      }),
      bindCanvasStrokeSizeProperty(
        strokeSizeCanvasProperty,
        () => readCanvasEdgeStrokeWidth(edge.style),
        (strokeWidth) =>
          updateEdge(edge.id, (currentEdge) => ({
            ...currentEdge,
            style: {
              ...currentEdge.style,
              strokeWidth,
            },
          })),
      ),
    ],
  }
}
