import type { ParsedCanvasEdgeStyle, ParsedCanvasRuntimeEdge } from 'convex/canvases/validation'
import type { CanvasNormalizedEdgeStyle } from './shared/canvas-edge-style'
import type { CanvasEdge, CanvasHandlePosition, CanvasNode } from '../types/canvas-domain-types'
import type { CSSProperties, ReactNode } from 'react'

export type CanvasEdgeType = 'bezier' | 'straight' | 'step'

export type CanvasEdgeRendererProps<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends CanvasEdgeType = CanvasEdgeType,
> = CanvasEdge<TData, TType> & {
  type: TType
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: CanvasHandlePosition
  targetPosition: CanvasHandlePosition
  sourceHandleId?: string | null
  targetHandleId?: string | null
  label?: ReactNode
  labelStyle?: CSSProperties
  labelShowBg?: boolean
  labelBgStyle?: CSSProperties
  labelBgPadding?: [number, number]
  labelBgBorderRadius?: number
}

export type CanvasEdgeRenderGeometryProps = Pick<
  CanvasEdgeRendererProps,
  'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
>

export type CanvasRuntimeEdge = Omit<ParsedCanvasRuntimeEdge, 'style'> & {
  style: CanvasNormalizedEdgeStyle
}

export type CanvasEdgePatch = {
  type?: CanvasEdgeType
  style?: Partial<ParsedCanvasEdgeStyle>
}

export interface CanvasEdgeSelectionContext {
  nodesById: ReadonlyMap<string, CanvasNode>
  zoom: number
}
