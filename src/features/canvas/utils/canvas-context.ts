import { createContext } from 'react'

export type RemoteHighlight = { color: string; name: string }

type Position = { x: number; y: number }
type ResizeHandler = (
  nodeId: string,
  width: number,
  height: number,
  position: Position,
) => void

export interface CanvasContextValue {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  onResize: ResizeHandler
  onResizeEnd: ResizeHandler
  remoteHighlights: Map<string, RemoteHighlight>
  canEdit: boolean
  user: RemoteHighlight
  editingEmbedId: string | null
  setEditingEmbedId: (id: string | null) => void
}

const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()
const DEFAULT_USER = { name: 'Anonymous', color: '#61afef' }

export const CanvasContext = createContext<CanvasContextValue>({
  updateNodeData: () => {},
  onResize: () => {},
  onResizeEnd: () => {},
  remoteHighlights: EMPTY_HIGHLIGHTS,
  canEdit: false,
  user: DEFAULT_USER,
  editingEmbedId: null,
  setEditingEmbedId: () => {},
})
CanvasContext.displayName = 'CanvasContext'
