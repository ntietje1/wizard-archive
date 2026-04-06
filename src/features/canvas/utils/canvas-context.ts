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
  canEdit: boolean
  user: { name: string; color: string }
  editingEmbedId: string | null
  setEditingEmbedId: (id: string | null) => void
}

const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()
const DEFAULT_USER = { name: 'Anonymous', color: '#61afef' }

export const CanvasContext = createContext<CanvasContextValue>({
  updateNodeData: () => {},
  onResizeEnd: () => {},
  remoteHighlights: EMPTY_HIGHLIGHTS,
  canEdit: false,
  user: DEFAULT_USER,
  editingEmbedId: null,
  setEditingEmbedId: () => {},
})
CanvasContext.displayName = 'CanvasContext'
