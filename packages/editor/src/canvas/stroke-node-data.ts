import type { CanvasStrokeNodeData } from './document-contract'
import { parseCanvasBounds, parseCanvasPoints } from './geometry'
import { hasOnlyKeys, isFiniteNumber, isRecord } from './parser-primitives'
import { parseCanvasNodeSurfaceOpacity } from './surface-style'

export function parseCanvasStrokeNodeData(value: unknown): CanvasStrokeNodeData | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, new Set(['points', 'color', 'size', 'opacity', 'bounds']))
  ) {
    return null
  }

  const points = parseCanvasPoints(value.points)
  const bounds = parseCanvasBounds(value.bounds)
  if (!points || typeof value.color !== 'string' || !isFiniteNumber(value.size) || !bounds) {
    return null
  }
  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) {
    return null
  }

  return {
    points,
    color: value.color,
    size: value.size,
    ...(value.opacity !== undefined
      ? { opacity: parseCanvasNodeSurfaceOpacity(value.opacity) }
      : {}),
    bounds,
  }
}
