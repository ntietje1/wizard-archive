import { clampNumber, isFiniteNumber } from './parser-primitives'
import type { CanvasEmbedNodeData } from './document-contract'

export const canvasSurfaceStyleKeys = new Set([
  'textColor',
  'backgroundColor',
  'backgroundOpacity',
  'borderStroke',
  'borderOpacity',
  'borderWidth',
])

function parseCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined
}

export function parseCanvasNodeSurfaceOpacity(value: unknown, fallback = 100): number {
  return isFiniteNumber(value) ? clampNumber(value, 0, 100) : fallback
}

function parseCanvasNodeBorderWidth(value: unknown, fallback = 1): number {
  return isFiniteNumber(value) ? clampNumber(value, 0, 99) : fallback
}

export function parseCanvasSurfaceStyles(
  value: Record<string, unknown>,
): Partial<CanvasEmbedNodeData> | null {
  const styles: Partial<CanvasEmbedNodeData> = {}

  for (const key of canvasSurfaceStyleKeys) {
    if (!(key in value)) continue

    switch (key) {
      case 'textColor':
      case 'backgroundColor':
      case 'borderStroke': {
        const color = parseCanvasNodeSurfaceColor(value[key])
        if (color === undefined) return null
        styles[key] = color
        break
      }
      case 'backgroundOpacity':
      case 'borderOpacity': {
        if (!isFiniteNumber(value[key])) return null
        styles[key] = parseCanvasNodeSurfaceOpacity(value[key])
        break
      }
      case 'borderWidth': {
        if (!isFiniteNumber(value[key])) return null
        styles.borderWidth = parseCanvasNodeBorderWidth(value[key])
        break
      }
    }
  }

  return styles
}
