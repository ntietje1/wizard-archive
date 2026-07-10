import { isRecord } from './parser-primitives'

interface ParsedCanvasReorderPayload {
  kind: 'reorder'
  direction: 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'
}

export function parseCanvasReorderPayload(value: unknown): ParsedCanvasReorderPayload | null {
  if (!isRecord(value) || value.kind !== 'reorder') return null
  const direction = value.direction
  return direction === 'sendToBack' ||
    direction === 'sendBackward' ||
    direction === 'bringForward' ||
    direction === 'bringToFront'
    ? { kind: 'reorder', direction }
    : null
}
