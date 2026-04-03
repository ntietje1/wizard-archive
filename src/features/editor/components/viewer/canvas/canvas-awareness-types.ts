export type DrawingState = {
  points: Array<[number, number, number]>
  color: string
  size: number
}

export type SelectingState =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'lasso'; points: Array<{ x: number; y: number }> }

export type CanvasAwarenessState = {
  user: { name: string; color: string }
  cursor: { x: number; y: number } | null
  dragging: Record<string, { x: number; y: number }> | null
  selectedNodeIds: Array<string> | null
  drawing: DrawingState | null
  selecting: SelectingState | null
}

export type RemoteUser = CanvasAwarenessState & {
  clientId: number
}
