import type { CSSProperties } from 'react'

export interface CanvasNodeSurfaceStyleData {
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export const DEFAULT_CANVAS_NODE_BACKGROUND_COLOR = 'var(--background)' as const
export const DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY = 100 as const
export const DEFAULT_CANVAS_NODE_BORDER_STROKE = 'var(--border)' as const
export const DEFAULT_CANVAS_NODE_BORDER_OPACITY = 100 as const
export const DEFAULT_CANVAS_NODE_BORDER_WIDTH = 1 as const

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampNumber(value, min, max)
    : fallback
}

export function readCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  if (typeof value === 'string') {
    return value
  }

  return value === null ? null : undefined
}

export function readCanvasNodeSurfaceOpacity(value: unknown): number {
  return readNumber(value, DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY, 0, 100)
}

export function readCanvasNodeBorderWidth(value: unknown): number {
  return readNumber(value, DEFAULT_CANVAS_NODE_BORDER_WIDTH, 0, 99)
}

function resolveCanvasNodePaint(color: string | null | undefined, opacity: number): string {
  if (!color || opacity <= 0) {
    return 'transparent'
  }

  if (opacity >= 100) {
    return color
  }

  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}

export function getCanvasNodeSurfaceStyle(data: CanvasNodeSurfaceStyleData): CSSProperties {
  const backgroundOpacity = readCanvasNodeSurfaceOpacity(data.backgroundOpacity)
  const borderOpacity = readCanvasNodeSurfaceOpacity(data.borderOpacity)
  const borderWidth = readCanvasNodeBorderWidth(data.borderWidth)

  return {
    backgroundColor: resolveCanvasNodePaint(data.backgroundColor, backgroundOpacity),
    border:
      data.borderStroke !== null && data.borderStroke !== undefined && data.borderStroke !== ''
        ? `${borderWidth}px solid ${resolveCanvasNodePaint(data.borderStroke, borderOpacity)}`
        : 'none',
  }
}
