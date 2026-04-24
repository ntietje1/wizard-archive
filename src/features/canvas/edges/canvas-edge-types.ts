import type { ParsedCanvasRuntimeEdge } from 'convex/canvases/validation'
import type { Edge, EdgeProps, Node } from '@xyflow/react'
import type { CanvasNormalizedEdgeStyle } from './shared/canvas-edge-style'

export type CanvasEdgeType = 'bezier' | 'straight' | 'step'

export type CanvasEdgeRendererProps<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends CanvasEdgeType = CanvasEdgeType,
> = EdgeProps<Edge<TData, TType>>

export type CanvasRuntimeEdge = Omit<ParsedCanvasRuntimeEdge, 'style'> & {
  style: CanvasNormalizedEdgeStyle
}

export interface CanvasEdgeSelectionContext {
  nodesById: ReadonlyMap<string, Node>
  zoom: number
}
