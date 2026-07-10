import { isRecord } from './parser-primitives'
import type { CanvasSelectionSnapshot } from './system/canvas-selection'
import type { CanvasAwarenessSelection } from './utils/canvas-awareness-types'

export function parseCanvasSelectionAwarenessState(
  value: unknown,
): CanvasAwarenessSelection | null {
  if (!isRecord(value) || value.version !== 1) return null
  const { nodeIds, edgeIds } = value
  return isStringArray(nodeIds) && isStringArray(edgeIds) ? { version: 1, nodeIds, edgeIds } : null
}

export function serializeCanvasSelectionAwarenessState(
  selection: CanvasSelectionSnapshot,
): CanvasAwarenessSelection | null {
  return parseCanvasSelectionAwarenessState({
    version: 1,
    nodeIds: Array.from(selection.nodeIds),
    edgeIds: Array.from(selection.edgeIds),
  })
}

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
