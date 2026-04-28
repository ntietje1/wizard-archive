import type { CSSProperties } from 'react'
import {
  parseCanvasNodeBorderWidth,
  parseCanvasNodeSurfaceColor,
  parseCanvasNodeSurfaceOpacity,
} from 'convex/canvases/validation'
import {
  fillCanvasProperty,
  linePaintCanvasProperty,
  strokeSizeCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import type { CanvasNodeRenderDataByType, CanvasRuntimeNode } from '../canvas-node-types'
import type { CanvasNodeType } from '../../types/canvas-domain-types'

export interface CanvasNodeSurfaceStyleData {
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

const DEFAULT_CANVAS_NODE_BACKGROUND_COLOR = 'var(--background)' as const
const DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY = 100 as const
const DEFAULT_CANVAS_NODE_BORDER_STROKE = 'var(--border)' as const
const DEFAULT_CANVAS_NODE_BORDER_WIDTH = 1 as const

export interface CanvasNormalizedNodeSurfaceStyleData {
  backgroundColor: string | null
  backgroundOpacity: number
  borderStroke: string | null
  borderOpacity: number
  borderWidth: number
}

function readCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  return parseCanvasNodeSurfaceColor(value)
}

function readCanvasNodeSurfaceOpacity(value: unknown): number {
  return parseCanvasNodeSurfaceOpacity(value, DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY)
}

function readCanvasNodeBorderWidth(value: unknown): number {
  return parseCanvasNodeBorderWidth(value, DEFAULT_CANVAS_NODE_BORDER_WIDTH)
}

export function normalizeCanvasNodeSurfaceStyleData(
  data: Partial<CanvasNodeSurfaceStyleData> | undefined,
): CanvasNormalizedNodeSurfaceStyleData {
  return {
    backgroundColor:
      readCanvasNodeSurfaceColor(data?.backgroundColor) ?? DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
    backgroundOpacity: readCanvasNodeSurfaceOpacity(data?.backgroundOpacity),
    borderStroke:
      readCanvasNodeSurfaceColor(data?.borderStroke) ?? DEFAULT_CANVAS_NODE_BORDER_STROKE,
    borderOpacity: readCanvasNodeSurfaceOpacity(data?.borderOpacity),
    borderWidth: readCanvasNodeBorderWidth(data?.borderWidth),
  }
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

  return {
    backgroundColor: resolveCanvasNodePaint(
      surfaceStyle.backgroundColor,
      surfaceStyle.backgroundOpacity,
    ),
    border:
      surfaceStyle.borderStroke !== null && surfaceStyle.borderStroke !== ''
        ? `${surfaceStyle.borderWidth}px solid ${resolveCanvasNodePaint(
            surfaceStyle.borderStroke,
            surfaceStyle.borderOpacity,
          )}`
        : 'none',
  }
}

export function bindCanvasNodeSurfaceFillProperty<
  TType extends CanvasNodeType,
  TData extends CanvasNodeRenderDataByType[TType] & CanvasNormalizedNodeSurfaceStyleData,
>(
  node: CanvasRuntimeNode<TType, TData>,
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasPaintProperty(fillCanvasProperty, {
    getColor: () => node.data.backgroundColor,
    setValue: ({ color: backgroundColor, opacity: backgroundOpacity }) =>
      patchNodeData(node.id, { backgroundColor, backgroundOpacity } as Partial<TData>),
    setColor: (backgroundColor) => patchNodeData(node.id, { backgroundColor } as Partial<TData>),
    getOpacity: () => node.data.backgroundOpacity,
    setOpacity: (backgroundOpacity) =>
      patchNodeData(node.id, { backgroundOpacity } as Partial<TData>),
  })
}

export function bindCanvasNodeSurfaceBorderPaintProperty<
  TType extends CanvasNodeType,
  TData extends CanvasNodeRenderDataByType[TType] & CanvasNormalizedNodeSurfaceStyleData,
>(
  node: CanvasRuntimeNode<TType, TData>,
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasPaintProperty(linePaintCanvasProperty, {
    getColor: () => node.data.borderStroke,
    setValue: ({ color: borderStroke, opacity: borderOpacity }) =>
      patchNodeData(node.id, { borderStroke, borderOpacity } as Partial<TData>),
    setColor: (borderStroke) => patchNodeData(node.id, { borderStroke } as Partial<TData>),
    getOpacity: () => node.data.borderOpacity,
    setOpacity: (borderOpacity) => patchNodeData(node.id, { borderOpacity } as Partial<TData>),
  })
}

export function bindCanvasNodeSurfaceBorderWidthProperty<
  TType extends CanvasNodeType,
  TData extends CanvasNodeRenderDataByType[TType] & CanvasNormalizedNodeSurfaceStyleData,
>(
  node: CanvasRuntimeNode<TType, TData>,
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasStrokeSizeProperty(
    strokeSizeCanvasProperty,
    () => node.data.borderWidth,
    (borderWidth) => patchNodeData(node.id, { borderWidth } as Partial<TData>),
  )
}
