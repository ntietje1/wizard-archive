import type { CanvasNodeId } from '../../resources/domain-id'

export type CanvasPosition = {
  x: number
  y: number
}

export type CanvasViewport = CanvasPosition & {
  zoom: number
}

export const CANVAS_HANDLE_POSITION = {
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
  Left: 'left',
} as const

export type CanvasHandlePosition =
  (typeof CANVAS_HANDLE_POSITION)[keyof typeof CANVAS_HANDLE_POSITION]

export type CanvasConnection = {
  source: CanvasNodeId
  target: CanvasNodeId
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type CanvasDocumentNodePatch = {
  position?: CanvasPosition
  width?: number
  height?: number
  zIndex?: number
}
