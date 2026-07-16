import { isFiniteNumber, isRecord } from './parser-primitives'
import { CANVAS_WORKLOAD_LIMITS } from './workload'

interface ParsedCanvasPoint2D {
  x: number
  y: number
}

interface ParsedCanvasBounds {
  x: number
  y: number
  width: number
  height: number
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
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > CANVAS_WORKLOAD_LIMITS.pointsPerStroke
  ) {
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
