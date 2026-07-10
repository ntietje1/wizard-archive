import type { CSSProperties } from 'react'
import {
  parseCanvasNodeBorderWidth,
  parseCanvasNodeSurfaceColor,
  parseCanvasNodeSurfaceOpacity,
} from './surface-style'
import { resolveCanvasScreenMinimumStrokeWidthCss } from './screen-stroke-width'

export interface CanvasNodeSurfaceStyleData {
  textColor?: string | null
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

const DEFAULT_CANVAS_NODE_BACKGROUND_COLOR = 'var(--background)' as const
const DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY = 100 as const
const DEFAULT_CANVAS_NODE_BORDER_OPACITY = 100 as const
const DEFAULT_CANVAS_NODE_BORDER_STROKE = 'var(--border)' as const
const DEFAULT_CANVAS_NODE_BORDER_WIDTH = 1 as const
const DEFAULT_CANVAS_NODE_TEXT_COLOR = 'var(--foreground)' as const

export interface CanvasNormalizedNodeSurfaceStyleData {
  textColor: string
  backgroundColor: string | null
  backgroundOpacity: number
  borderStroke: string | null
  borderOpacity: number
  borderWidth: number
}

function readCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  return parseCanvasNodeSurfaceColor(value)
}

function readCanvasNodeTextColor(value: unknown): string | null | undefined {
  const textColor = readCanvasNodeSurfaceColor(value)
  if (typeof textColor !== 'string') {
    return textColor
  }

  const trimmedTextColor = textColor.trim()
  return isCanvasNodeTextColor(trimmedTextColor) ? trimmedTextColor : undefined
}

function isCanvasNodeTextColor(value: string): boolean {
  return (
    /^var\(--[A-Za-z0-9_-]+\)$/.test(value) ||
    /^#[\da-f]{3,4}$/i.test(value) ||
    /^#[\da-f]{6}([\da-f]{2})?$/i.test(value)
  )
}

function readCanvasNodeSurfaceOpacity(value: unknown): number {
  return parseCanvasNodeSurfaceOpacity(value, DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY)
}

function readCanvasNodeBorderOpacity(value: unknown): number {
  return parseCanvasNodeSurfaceOpacity(value, DEFAULT_CANVAS_NODE_BORDER_OPACITY)
}

function readCanvasNodeBorderWidth(value: unknown): number {
  return parseCanvasNodeBorderWidth(value, DEFAULT_CANVAS_NODE_BORDER_WIDTH)
}

export function normalizeCanvasNodeSurfaceStyleData(
  data: Partial<CanvasNodeSurfaceStyleData> | undefined,
): CanvasNormalizedNodeSurfaceStyleData {
  return {
    textColor: readCanvasNodeTextColor(data?.textColor) ?? DEFAULT_CANVAS_NODE_TEXT_COLOR,
    backgroundColor:
      readCanvasNodeSurfaceColor(data?.backgroundColor) ?? DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
    backgroundOpacity: readCanvasNodeSurfaceOpacity(data?.backgroundOpacity),
    borderStroke:
      readCanvasNodeSurfaceColor(data?.borderStroke) ?? DEFAULT_CANVAS_NODE_BORDER_STROKE,
    borderOpacity: readCanvasNodeBorderOpacity(data?.borderOpacity),
    borderWidth: readCanvasNodeBorderWidth(data?.borderWidth),
  }
}

export function getCanvasNodeTextStyle(data: CanvasNodeSurfaceStyleData): CSSProperties {
  const color = getCanvasNodeDefaultTextColor(data)

  return {
    color,
    '--bn-colors-editor-text': color,
  } as CSSProperties
}

export function getCanvasNodeDefaultTextColor(data: CanvasNodeSurfaceStyleData): string {
  return normalizeCanvasNodeSurfaceStyleData(data).textColor
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
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(data)
  const hasBorder =
    surfaceStyle.borderWidth > 0 &&
    surfaceStyle.borderOpacity > 0 &&
    surfaceStyle.borderStroke !== null &&
    surfaceStyle.borderStroke !== ''
  const backgroundColor = resolveCanvasNodePaint(
    surfaceStyle.backgroundColor,
    surfaceStyle.backgroundOpacity,
  )

  if (!hasBorder) {
    return {
      backgroundColor,
      border: 'none',
    }
  }

  return {
    backgroundColor,
    borderColor: resolveCanvasNodePaint(surfaceStyle.borderStroke, surfaceStyle.borderOpacity),
    borderStyle: 'solid',
    borderWidth: resolveCanvasScreenMinimumStrokeWidthCss(surfaceStyle.borderWidth),
  }
}
