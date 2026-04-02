export type CanvasAwarenessState = {
  user: { name: string; color: string }
  cursor: { x: number; y: number } | null
  dragging: Record<string, { x: number; y: number }> | null
  selectedNodeIds: Array<string> | null
}

export type RemoteUser = CanvasAwarenessState & {
  clientId: number
}
