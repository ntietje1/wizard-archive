import type { CanvasNodeId } from '../resources/domain-id'

export type CanvasTool = 'draw' | 'edge' | 'eraser' | 'hand' | 'lasso' | 'select' | 'text'

export type CanvasToolSettings = Readonly<{
  edgeType: 'bezier' | 'straight' | 'step'
  strokeColor: string
  strokeOpacity: number
  strokeSize: number
}>

export type CanvasPoint = Readonly<{ x: number; y: number }>

export type CanvasViewport = CanvasPoint & Readonly<{ zoom: number }>

export type CanvasSelection = Readonly<{
  nodeIds: ReadonlySet<CanvasNodeId>
  edgeIds: ReadonlySet<string>
}>

export type CanvasDrawPoint = readonly [x: number, y: number, pressure: number]

export type CanvasConnectionHandle = 'bottom' | 'left' | 'right' | 'top'

export type CanvasConnectionAnchor = Readonly<{
  nodeId: CanvasNodeId
  handle: CanvasConnectionHandle
}>

export type CanvasResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
