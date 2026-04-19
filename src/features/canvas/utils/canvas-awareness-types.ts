export type Point2D = { x: number; y: number }
export type CanvasAwarenessNamespace = `core.${string}` | `tool.${string}` | `node.${string}`
export type CanvasAwarenessPresence = Partial<Record<CanvasAwarenessNamespace, unknown>>

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

export type ResizingState = Record<string, { width: number; height: number; x: number; y: number }>

export type RemoteHighlight = {
  color: string
  name: string
}

export type SelectingState =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'lasso'; points: Array<Point2D> }

/**
 * Complete awareness state for a user's canvas activity.
 * Tracks cursor position, active drag/resize/draw/select operations.
 * All operation states are nullable when inactive.
 */
type CanvasAwarenessState = {
  user: { name: string; color: string }
  presence: CanvasAwarenessPresence
}

/**
 * Remote user's awareness state, including their unique client identifier.
 */
export type RemoteUser = CanvasAwarenessState & {
  clientId: number
  cursor: Point2D | null
  dragging: Record<string, Point2D> | null
  resizing: ResizingState | null
  selectedNodeIds: Array<string> | null
  drawing: DrawingState | null
  selecting: SelectingState | null
}
