import type { EmbedNodeData } from '../embed-node-model'
import type { CanvasTextNodeInputData, CanvasTextNodeRenderData } from '../text/node-data'
import type { StrokeNodeData } from './stroke/stroke-node-model'
import type { CanvasPosition } from '../types/canvas-domain-types'
import type {
  CanvasEmbedNodeData,
  CanvasNodeType,
  CanvasStrokeNodeData,
  CanvasTextNodeData,
} from '../document-contract'

export interface CanvasNodeDataByType {
  embed: CanvasEmbedNodeData
  stroke: CanvasStrokeNodeData
  text: CanvasTextNodeData
}

interface SharedCanvasNodeDataByType {
  embed: EmbedNodeData
  stroke: StrokeNodeData
}

interface CanvasNodeRenderDataByType extends SharedCanvasNodeDataByType {
  text: CanvasTextNodeRenderData
}

interface CanvasNodeComponentDataByType extends SharedCanvasNodeDataByType {
  text: CanvasTextNodeInputData
}

export type CanvasRuntimeNode<
  TType extends CanvasNodeType = CanvasNodeType,
  TData extends CanvasNodeRenderDataByType[TType] = CanvasNodeRenderDataByType[TType],
> = {
  id: string
  type: TType
  position: CanvasPosition
  data: TData
  width?: number
  height?: number
  hidden?: boolean
  zIndex?: number
  className?: string
}

export interface CanvasNodeCreateArgs<TType extends CanvasNodeType = CanvasNodeType> {
  position: CanvasPosition
  size?: { width: number; height: number }
  data?: Partial<CanvasNodeDataByType[TType]>
}

export interface CanvasNodeComponentProps<TType extends CanvasNodeType = CanvasNodeType> {
  id: string
  type?: TType
  data: CanvasNodeComponentDataByType[TType]
  dragging?: boolean
  selected?: boolean
  width?: number
  height?: number
}

export interface CanvasNodeSelectionContext {
  zoom: number
}
