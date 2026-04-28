import type { CanvasNormalizedEdgeStyle } from './shared/canvas-edge-style'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasEdgeStyle,
  CanvasEdgeType,
  CanvasHandlePosition,
} from '../types/canvas-domain-types'

export type { CanvasEdgeType }

export interface CanvasEdgeRendererProps<TType extends CanvasEdgeType = CanvasEdgeType> {
  id: string
  type: TType
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  style?: CanvasEdgeStyle
  selected?: boolean
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: CanvasHandlePosition
  targetPosition: CanvasHandlePosition
  sourceHandleId?: string | null
  targetHandleId?: string | null
}

export type CanvasEdgeRenderGeometryProps = Pick<
  CanvasEdgeRendererProps,
  'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
>

export type CanvasRuntimeEdge = Omit<CanvasDocumentEdge, 'style'> & {
  style: CanvasNormalizedEdgeStyle
}

export type CanvasEdgePatch = {
  type?: CanvasEdgeType
  style?: Partial<CanvasEdgeStyle>
}

export interface CanvasEdgeSelectionContext {
  nodesById: ReadonlyMap<string, CanvasDocumentNode>
  zoom: number
}
