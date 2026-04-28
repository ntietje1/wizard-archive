import type {
  CanvasEmbedNodeData,
  CanvasStrokeNodeData,
  CanvasTextNodeData,
} from 'convex/canvases/validation'
import type { EmbedNodeData } from './embed/embed-node-data'
import type {
  CanvasRichTextNodeData,
  CanvasRichTextNodeInputData,
} from './shared/canvas-rich-text-node-data'
import type { StrokeNodeData } from './stroke/stroke-node-model'
import type { CanvasNodeType, CanvasPosition } from '../types/canvas-domain-types'

export const CANVAS_NODE_TYPES = [
  'embed',
  'stroke',
  'text',
] as const satisfies ReadonlyArray<CanvasNodeType>

export interface CanvasNodeDataByType {
  embed: CanvasEmbedNodeData
  stroke: CanvasStrokeNodeData
  text: CanvasTextNodeData
}

export interface CanvasNodeRenderDataByType {
  embed: EmbedNodeData
  stroke: StrokeNodeData
  text: CanvasRichTextNodeData
}

export interface CanvasNodeComponentDataByType {
  embed: EmbedNodeData
  stroke: StrokeNodeData
  text: CanvasRichTextNodeInputData
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

export interface CanvasNodeComponentProps<TData = CanvasNodeComponentDataByType[CanvasNodeType]> {
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
