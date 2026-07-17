import type { CanvasEdgeStyle } from './document-contract'

export const CANVAS_EDGE_PENDING_OPACITY = 0.45

type CanvasResolvedEdgeStyle = Readonly<{
  stroke: string
  strokeWidth: number
  opacity: number
}>

export function resolveCanvasEdgeStyle(
  style: CanvasEdgeStyle | undefined,
): CanvasResolvedEdgeStyle {
  return {
    stroke: style?.stroke?.trim() ? style.stroke : 'var(--foreground)',
    strokeWidth:
      style?.strokeWidth !== undefined && Number.isFinite(style.strokeWidth)
        ? Math.max(1, style.strokeWidth)
        : 1.5,
    opacity:
      style?.opacity !== undefined && Number.isFinite(style.opacity)
        ? Math.max(0, Math.min(1, style.opacity))
        : 1,
  }
}

export function canvasScreenStrokeWidth(strokeWidth: number, zoom: number): number {
  return Math.max(strokeWidth, 1 / zoom)
}
