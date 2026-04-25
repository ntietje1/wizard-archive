import type { XYPosition } from '@xyflow/react'
import type {
  ParsedCanvasRuntimeEmbedNode,
  ParsedCanvasRuntimeStrokeNode,
  ParsedCanvasRuntimeTextNode,
} from 'convex/canvases/validation'

/**
 * Raw node creation/input data stays broad at the React Flow boundary; stricter node contracts are
 * enforced through the parsed runtime node types and per-node normalizers.
 */
export type CanvasNodeData = Record<string, unknown>

export type CanvasNodeType =
  | ParsedCanvasRuntimeEmbedNode['type']
  | ParsedCanvasRuntimeStrokeNode['type']
  | ParsedCanvasRuntimeTextNode['type']

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
  position: XYPosition
  size?: { width: number; height: number }
  data?: CanvasNodeData
}

export interface CanvasNodeMinimapProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  borderRadius?: number
  shapeRendering?: string
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
