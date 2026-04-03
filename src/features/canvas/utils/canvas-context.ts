import { createContext } from 'react'

export type RemoteHighlight = { color: string; name: string }

export interface CanvasContextValue {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  remoteHighlights: Map<string, RemoteHighlight>
}

const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()

export const CanvasContext = createContext<CanvasContextValue>({
  updateNodeData: () => {},
  remoteHighlights: EMPTY_HIGHLIGHTS,
})
