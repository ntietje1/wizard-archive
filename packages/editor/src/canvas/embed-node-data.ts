import { parseAuthoredDestination } from '../resources/authored-destination'
import type { CanvasEmbedNodeData } from './document-contract'
import { hasOnlyKeys, isFiniteNumber, isRecord } from './parser-primitives'
import { canvasSurfaceStyleKeys, parseCanvasSurfaceStyles } from './surface-style'

const embedDataKeys = new Set(['destination', 'lockedAspectRatio', ...canvasSurfaceStyleKeys])

function parseCanvasLockedAspectRatio(value: unknown): number | undefined {
  return isFiniteNumber(value) && value > 0 ? value : undefined
}

export function parseCanvasEmbedNodeData(value: unknown): CanvasEmbedNodeData | null {
  if (!isRecord(value) || !hasOnlyKeys(value, embedDataKeys)) return null

  const data: CanvasEmbedNodeData = {}
  if ('destination' in value) {
    const destination = parseAuthoredDestination(value.destination)
    if (!destination) return null
    data.destination = destination
  }
  if ('lockedAspectRatio' in value) {
    const lockedAspectRatio = parseCanvasLockedAspectRatio(value.lockedAspectRatio)
    if (lockedAspectRatio === undefined) return null
    data.lockedAspectRatio = lockedAspectRatio
  }

  const styles = parseCanvasSurfaceStyles(value)
  return styles ? { ...data, ...styles } : null
}
