import type { CanvasEdgeStyle, CanvasEdgeType } from './document-contract'
import { clampNumber, hasOnlyKeys, isFiniteNumber, isRecord } from './parser-primitives'

export function parseCanvasEdgeType(value: unknown): CanvasEdgeType | null {
  return value === 'bezier' || value === 'straight' || value === 'step' ? value : null
}

export function parseCanvasEdgeStyle(value: unknown): CanvasEdgeStyle | null {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(['stroke', 'strokeWidth', 'opacity']))) {
    return null
  }
  if (value.stroke !== undefined && (typeof value.stroke !== 'string' || value.stroke.length < 1)) {
    return null
  }
  if (
    value.strokeWidth !== undefined &&
    (!isFiniteNumber(value.strokeWidth) || value.strokeWidth < 0)
  ) {
    return null
  }
  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) {
    return null
  }

  return {
    ...(value.stroke !== undefined ? { stroke: value.stroke } : {}),
    ...(value.strokeWidth !== undefined ? { strokeWidth: value.strokeWidth } : {}),
    ...(value.opacity !== undefined ? { opacity: clampNumber(value.opacity, 0, 1) } : {}),
  }
}
