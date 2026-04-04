import { createContext } from 'react'

export type RemoteHighlight = { color: string; name: string }

export interface CanvasContextValue {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  onResizeEnd: (
    nodeId: string,
    width: number,
    height: number,
    position: { x: number; y: number },
  ) => void
  remoteHighlights: Map<string, RemoteHighlight>
}

const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()

export const CanvasContext = createContext<CanvasContextValue>({
  updateNodeData: () => {},
  onResizeEnd: () => {},
  remoteHighlights: EMPTY_HIGHLIGHTS,
})
