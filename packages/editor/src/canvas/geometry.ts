import { isFiniteNumber, isRecord } from './parser-primitives'

export interface ParsedCanvasPoint2D {
  x: number
  y: number
}

interface ParsedCanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasBoundsDimensions {
  width: number
  height: number
}

interface ParsedCanvasStrokeSelectionData {
  points: Array<[number, number, number]>
  size: number
  bounds: ParsedCanvasBounds
}

function parsePoint(value: unknown): [number, number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !isFiniteNumber(value[0]) ||
    !isFiniteNumber(value[1]) ||
    !isFiniteNumber(value[2])
  ) {
    return null
  }
  return [value[0], value[1], value[2]]
}

export function parseCanvasPoints(value: unknown): Array<[number, number, number]> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const points = value.map(parsePoint)
  return points.every((point) => point !== null)
    ? (points as Array<[number, number, number]>)
    : null
}

export function parseCanvasBounds(value: unknown): ParsedCanvasBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
    ? { x, y, width, height }
    : null
}

export function parseCanvasPoint2D(value: unknown): ParsedCanvasPoint2D | null {
  if (!isRecord(value)) return null
  const { x, y } = value
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null
}

export function parseCanvasBoundsDimensions(value: unknown): ParsedCanvasBoundsDimensions | null {
  if (!isRecord(value)) return null
  const { width, height } = value
  return isFiniteNumber(width) && isFiniteNumber(height) ? { width, height } : null
}

export function parseCanvasStrokeSelectionData(
  value: unknown,
): ParsedCanvasStrokeSelectionData | null {
  if (!isRecord(value)) return null
  const points = parseCanvasPoints(value.points)
  const bounds = parseCanvasBounds(value.bounds)
  return points && isFiniteNumber(value.size) && bounds
    ? { points, size: value.size, bounds }
    : null
}
