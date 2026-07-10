import { parseCanvasEdgeStyle } from '../../edge'
import { resolveCanvasScreenMinimumStrokeWidthCss } from '../../screen-stroke-width'
import type { CSSProperties } from 'react'

const DEFAULT_CANVAS_EDGE_STROKE = 'var(--foreground)'
const DEFAULT_CANVAS_EDGE_STROKE_WIDTH = 1.5
const DEFAULT_CANVAS_EDGE_OPACITY = 1
export const PENDING_PREVIEW_EDGE_OPACITY = 0.45
const MIN_CANVAS_EDGE_STROKE_WIDTH = 1

export interface CanvasNormalizedEdgeStyle {
  stroke: string
  strokeWidth: number
  opacity: number
}

export function normalizeCanvasEdgeStroke(stroke: unknown): string {
  return typeof stroke === 'string' && stroke.trim().length > 0
    ? stroke
    : DEFAULT_CANVAS_EDGE_STROKE
}

export function clampCanvasEdgeStrokeWidth(strokeWidth: number): number {
  return Number.isFinite(strokeWidth)
    ? Math.max(strokeWidth, MIN_CANVAS_EDGE_STROKE_WIDTH)
    : DEFAULT_CANVAS_EDGE_STROKE_WIDTH
}

function clampCanvasEdgeOpacity(opacity: number): number {
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : DEFAULT_CANVAS_EDGE_OPACITY
}

export function normalizeCanvasEdgeStyle(
  style: CSSProperties | undefined,
): CanvasNormalizedEdgeStyle {
  const parsedStyle = parseCanvasEdgeStyle(style) ?? {}

  return {
    stroke: normalizeCanvasEdgeStroke(parsedStyle.stroke),
    strokeWidth:
      parsedStyle.strokeWidth === undefined || !Number.isFinite(parsedStyle.strokeWidth)
        ? DEFAULT_CANVAS_EDGE_STROKE_WIDTH
        : clampCanvasEdgeStrokeWidth(parsedStyle.strokeWidth),
    opacity:
      typeof parsedStyle.opacity === 'number'
        ? clampCanvasEdgeOpacity(parsedStyle.opacity)
        : DEFAULT_CANVAS_EDGE_OPACITY,
  }
}

export function readCanvasEdgeStroke(style: CSSProperties | undefined): string {
  return normalizeCanvasEdgeStyle(style).stroke
}

export function readCanvasEdgeStrokeWidth(style: CSSProperties | undefined): number {
  return normalizeCanvasEdgeStyle(style).strokeWidth
}

export function readCanvasEdgeOpacityPercent(style: CSSProperties | undefined): number {
  const opacity = normalizeCanvasEdgeStyle(style).opacity
  return Math.round(opacity * 100)
}

export function buildCanvasEdgeRenderStyle(
  normalizedStyle: CanvasNormalizedEdgeStyle,
): CSSProperties {
  return {
    stroke: normalizedStyle.stroke,
    strokeWidth: resolveCanvasScreenMinimumStrokeWidthCss(normalizedStyle.strokeWidth),
    opacity: normalizedStyle.opacity,
  }
}
