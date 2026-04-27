import type { CSSProperties } from 'react'

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
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface CanvasNode<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends string = string,
> {
  id: string
  type?: TType
  position: CanvasPosition
  data: TData
  width?: number
  height?: number
  measured?: {
    width?: number
    height?: number
  }
  selected?: boolean
  selectable?: boolean
  draggable?: boolean
  connectable?: boolean
  deletable?: boolean
  focusable?: boolean
  dragging?: boolean
  resizing?: boolean
  hidden?: boolean
  zIndex?: number
  className?: string
  style?: CSSProperties
  parentId?: string
  extent?: 'parent' | [[number, number], [number, number]]
}

export interface CanvasEdge<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends string = string,
> extends CanvasConnection {
  id: string
  type?: TType
  data?: TData
  selected?: boolean
  animated?: boolean
  selectable?: boolean
  deletable?: boolean
  focusable?: boolean
  hidden?: boolean
  zIndex?: number
  className?: string
  style?: CSSProperties
  markerStart?: string
  markerEnd?: string
  interactionWidth?: number
}
