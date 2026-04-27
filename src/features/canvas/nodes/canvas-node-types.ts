import type {
  ParsedCanvasRuntimeEmbedNode,
  ParsedCanvasRuntimeStrokeNode,
  ParsedCanvasRuntimeTextNode,
} from 'convex/canvases/validation'
import type { CanvasPosition } from '../types/canvas-domain-types'

export const CANVAS_NODE_TYPES = ['embed', 'stroke', 'text'] as const

/**
 * Raw node creation/input data stays broad at the document boundary; stricter node contracts are
 * enforced through the parsed runtime node types and per-node normalizers.
 */
export type CanvasNodeData = Record<string, unknown>

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number]

interface CanvasParsedRuntimeNodeMap {
  embed: ParsedCanvasRuntimeEmbedNode
  stroke: ParsedCanvasRuntimeStrokeNode
  text: ParsedCanvasRuntimeTextNode
}

type CanvasParsedRuntimeNodeByType<TType extends CanvasNodeType> = CanvasParsedRuntimeNodeMap[TType]

export type CanvasRuntimeNode<
  TData extends CanvasNodeData = CanvasNodeData,
  TType extends CanvasNodeType = CanvasNodeType,
> = Omit<CanvasParsedRuntimeNodeByType<TType>, 'data'> & {
  data: TData
}

export interface CanvasNodeCreateArgs {
  position: CanvasPosition
  size?: { width: number; height: number }
  data?: CanvasNodeData
}

export interface CanvasNodeComponentProps<TData extends CanvasNodeData = CanvasNodeData> {
  id: string
  type?: CanvasNodeType
  data: TData
  dragging?: boolean
  selected?: boolean
  width?: number
  height?: number
}

export interface CanvasNodeSelectionContext {
  zoom: number
}

export interface CanvasNodePlacementBehavior {
  anchor: 'center' | 'top-left'
  selectOnCreate: boolean
  startEditingOnCreate: boolean
}
