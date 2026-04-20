import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { CanvasContextMenuCapability } from '../runtime/context-menu/canvas-context-menu-types'
import type { Edge, EdgeProps, EdgeTypes, Node } from '@xyflow/react'

export type CanvasEdgeType = 'bezier'

export type CanvasEdgeRendererProps = EdgeProps & {
  data: any
  type: any
}

type CanvasEdgeRenderer = EdgeTypes[string]

export interface CanvasEdgeSelectionContext {
  nodesById: ReadonlyMap<string, Node>
  zoom: number
}

interface CanvasEdgeSelection {
  getBounds: (edge: Edge, context: CanvasEdgeSelectionContext) => Bounds | null
  point: (edge: Edge, point: Point2D, context: CanvasEdgeSelectionContext) => boolean
  rectangle: (edge: Edge, rect: Bounds, context: CanvasEdgeSelectionContext) => boolean
  lasso: (edge: Edge, polygon: Array<Point2D>, context: CanvasEdgeSelectionContext) => boolean
}

export interface CanvasEdgeModule<TType extends CanvasEdgeType = CanvasEdgeType> {
  type: TType
  EdgeComponent: CanvasEdgeRenderer
  selection: CanvasEdgeSelection
  contextMenu?: CanvasContextMenuCapability
}

export type AnyCanvasEdgeModule = {
  [TType in CanvasEdgeType]: CanvasEdgeModule<TType>
}[CanvasEdgeType]
