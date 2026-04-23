import type { CSSProperties } from 'react'

export const DEFAULT_CANVAS_EDGE_STROKE = 'var(--foreground)'
export const DEFAULT_CANVAS_EDGE_STROKE_WIDTH = 1.5

export function readCanvasEdgeStroke(style: CSSProperties | undefined): string {
  return typeof style?.stroke === 'string' && style.stroke.length > 0
    ? style.stroke
    : DEFAULT_CANVAS_EDGE_STROKE
}

export function readCanvasEdgeStrokeWidth(style: CSSProperties | undefined): number {
  return typeof style?.strokeWidth === 'number' && Number.isFinite(style.strokeWidth)
    ? style.strokeWidth
    : DEFAULT_CANVAS_EDGE_STROKE_WIDTH
}
