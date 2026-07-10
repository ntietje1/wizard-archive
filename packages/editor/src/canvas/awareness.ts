import { parseCanvasBounds, parseCanvasPoint2D, parseCanvasPoints } from './geometry'
import type { ParsedCanvasPoint2D } from './geometry'
import { parseCanvasNodeSurfaceOpacity } from './surface-style'
import { isFiniteNumber, isRecord } from './parser-primitives'

interface ParsedCanvasAwarenessUser {
  name: string
  color: string
}

interface ParsedCanvasResizeAwarenessEntry {
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasDrawAwarenessState {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity: number
}

interface ParsedCanvasSelectAwarenessState {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasLassoAwarenessState {
  type: 'lasso'
  points: Array<ParsedCanvasPoint2D>
}

type ParsedCanvasResizingAwarenessState = Record<string, ParsedCanvasResizeAwarenessEntry>

export function parseCanvasAwarenessUser(value: unknown): ParsedCanvasAwarenessUser | null {
  if (!isRecord(value)) return null
  return typeof value.name === 'string' && typeof value.color === 'string'
    ? { name: value.name, color: value.color }
    : null
}

export function parseCanvasAwarenessPresence(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

export function parseCanvasDrawAwarenessState(
  value: unknown,
): ParsedCanvasDrawAwarenessState | null {
  if (!isRecord(value)) return null
  const points = parseCanvasPoints(value.points)
  return points &&
    typeof value.color === 'string' &&
    isFiniteNumber(value.size) &&
    value.size > 0 &&
    isFiniteNumber(value.opacity)
    ? {
        points,
        color: value.color,
        size: value.size,
        opacity: parseCanvasNodeSurfaceOpacity(value.opacity),
      }
    : null
}

export function parseCanvasSelectAwarenessState(
  value: unknown,
): ParsedCanvasSelectAwarenessState | null {
  if (!isRecord(value) || value.type !== 'rect') return null
  const { x, y, width, height } = value
  return isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    width >= 0 &&
    isFiniteNumber(height) &&
    height >= 0
    ? { type: 'rect', x, y, width, height }
    : null
}

export function parseCanvasLassoAwarenessState(
  value: unknown,
): ParsedCanvasLassoAwarenessState | null {
  if (!isRecord(value) || value.type !== 'lasso' || !Array.isArray(value.points)) {
    return null
  }

  const points = value.points.map(parseCanvasPoint2D)
  return points.every((point) => point !== null)
    ? { type: 'lasso', points: points as Array<ParsedCanvasPoint2D> }
    : null
}

export function parseCanvasResizingAwarenessState(
  value: unknown,
): ParsedCanvasResizingAwarenessState | null {
  if (!isRecord(value)) return null

  const entries: ParsedCanvasResizingAwarenessState = {}
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parseCanvasBounds(entry)
    if (!parsed || parsed.width < 0 || parsed.height < 0) {
      return null
    }
    entries[key] = parsed
  }
  return entries
}
