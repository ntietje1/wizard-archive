export type DrawingState = {
  points: Array<[number, number, number]>
  color: string
  size: number
}

export type CanvasAwarenessState = {
  user: { name: string; color: string }
  cursor: { x: number; y: number } | null
  dragging: Record<string, { x: number; y: number }> | null
  selectedNodeIds: Array<string> | null
  drawing: DrawingState | null
}

export type RemoteUser = CanvasAwarenessState & {
  clientId: number
}
