export type Point2D = { x: number; y: number }

/**
 * Serialized in-progress stroke data broadcast via awareness.
 * `points` — array of [x, y, pressure] tuples in flow-space pixels.
 * `color` — CSS color string. `size` — stroke width in px. `opacity` — 0–100.
 */
export type DrawingState = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity: number
}

export type ResizingState = Record<
  string,
  { width: number; height: number; x: number; y: number }
>

export type SelectingState =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'lasso'; points: Array<Point2D> }

export type CanvasAwarenessState = {
  user: { name: string; color: string }
  cursor: { x: number; y: number } | null
  dragging: Record<string, { x: number; y: number }> | null
  resizing: ResizingState | null
  selectedNodeIds: Array<string> | null
  drawing: DrawingState | null
  selecting: SelectingState | null
}

export type RemoteUser = CanvasAwarenessState & {
  clientId: number
}
