import { createCanvasNodeModule } from '../canvas-node-module-types'
import { StrokeMinimapNode, StrokeNode } from './stroke-node'
import type { StrokeNodeData } from './stroke-node-model'
import { clampStrokeNodeSize, resizeStrokeNode } from './stroke-node-model'
import {
  strokeNodeContainsPoint,
  strokeNodeIntersectsPolygon,
  strokeNodeIntersectsRect,
} from './stroke-node-interactions'
import {
  freehandStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'

function hasFiniteNumber(
  data: Record<string, unknown>,
  key: 'x' | 'y' | 'width' | 'height',
): boolean {
  return key in data && typeof data[key] === 'number' && Number.isFinite(data[key])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStrokeNodeData(data: Record<string, unknown>): data is StrokeNodeData {
  if (!Array.isArray(data.points) || data.points.length === 0) return false
  if (
    typeof data.color !== 'string' ||
    typeof data.size !== 'number' ||
    !Number.isFinite(data.size)
  )
    return false
  if (
    data.opacity !== undefined &&
    (typeof data.opacity !== 'number' ||
      !Number.isFinite(data.opacity) ||
      data.opacity < 0 ||
      data.opacity > 100)
  )
    return false

  return (
    isRecord(data.bounds) &&
    hasFiniteNumber(data.bounds, 'x') &&
    hasFiniteNumber(data.bounds, 'y') &&
    hasFiniteNumber(data.bounds, 'width') &&
    hasFiniteNumber(data.bounds, 'height') &&
    data.points.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 3 &&
        point.every((part) => typeof part === 'number' && Number.isFinite(part)),
    )
  )
}

export const strokeNodeModule = createCanvasNodeModule<StrokeNodeData, 'stroke'>({
  type: 'stroke',
  NodeComponent: StrokeNode,
  parseData: (data) =>
    isStrokeNodeData(data)
      ? {
          ...data,
          size: clampStrokeNodeSize(data.size),
        }
      : null,
  selection: {
    point: (node, point, context) => strokeNodeContainsPoint(node, point, context.zoom),
    rectangle: (node, rect, context) => strokeNodeIntersectsRect(node, rect, context.zoom),
    lasso: (node, polygon) => strokeNodeIntersectsPolygon(node, polygon),
  },
  properties: ({ node, updateNodeData }) => ({
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => node.data.color,
        setColor: (color) =>
          updateNodeData(node.id, {
            color: typeof color === 'string' && color.length > 0 ? color : node.data.color,
          }),
        getOpacity: () => node.data.opacity ?? 100,
        setOpacity: (opacity) => updateNodeData(node.id, { opacity }),
      }),
      bindCanvasStrokeSizeProperty(
        freehandStrokeSizeCanvasProperty,
        () => clampStrokeNodeSize(node.data.size),
        (size) => updateNodeData(node.id, { size: clampStrokeNodeSize(size) }),
      ),
    ],
  }),
  renderMinimap: (props) => <StrokeMinimapNode {...props} />,
  resize: (node, resize) => resizeStrokeNode(node, resize),
})
