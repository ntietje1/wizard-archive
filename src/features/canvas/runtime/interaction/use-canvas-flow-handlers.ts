import type {
  CanvasDocumentWriter,
  CanvasEdgeCreationDefaults,
  CanvasToolHandlers,
} from '../../tools/canvas-tool-types'
import type { Connection, Edge, Node, OnConnect, OnEdgesDelete, OnNodesDelete } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export interface CanvasFlowHandlers {
  onNodesDelete?: OnNodesDelete
  onEdgesDelete?: OnEdgesDelete
  onConnect?: OnConnect
  onMoveStart?: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd?: () => void
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
  onPaneClick?: (event: ReactMouseEvent) => void
  onMouseMove: (event: ReactMouseEvent) => void
  onMouseLeave: () => void
}

export function createCanvasFlowHandlers({
  activeToolHandlers,
  cancelConnectionDraft,
  canEdit,
  cursorPresence,
  documentWriter,
  getEdgeCreationDefaults,
  isEdgeMode,
  isSelectMode,
}: {
  activeToolHandlers: CanvasToolHandlers
  cancelConnectionDraft: () => void
  canEdit: boolean
  getEdgeCreationDefaults: () => CanvasEdgeCreationDefaults
  isEdgeMode: boolean
  isSelectMode: boolean
  cursorPresence: {
    onMouseLeave: () => void
    onMouseMove: (event: ReactMouseEvent) => void
  }
  documentWriter: CanvasDocumentWriter
}) {
  const canEditSelection = canEdit && isSelectMode
  const canCreateEdges = canEdit && isEdgeMode

  return {
    onNodesDelete: canEditSelection
      ? (deleted: Array<Node>) => {
          documentWriter.deleteNodes(new Set(deleted.map((node) => node.id)))
        }
      : undefined,
    onEdgesDelete: canEditSelection
      ? (deleted: Array<Edge>) => {
          documentWriter.deleteEdges(new Set(deleted.map((edge) => edge.id)))
        }
      : undefined,
    onConnect: canCreateEdges
      ? (connection: Connection) => {
          documentWriter.createEdge(connection, getEdgeCreationDefaults())
        }
      : undefined,
    onMoveStart: activeToolHandlers.onMoveStart,
    onMoveEnd: activeToolHandlers.onMoveEnd,
    onNodeClick: activeToolHandlers.onNodeClick,
    onEdgeClick: activeToolHandlers.onEdgeClick,
    onPaneClick: (event: ReactMouseEvent) => {
      if (canEdit && isEdgeMode) {
        cancelConnectionDraft()
      }

      activeToolHandlers.onPaneClick?.(event)
    },
    onMouseMove: cursorPresence.onMouseMove,
    onMouseLeave: cursorPresence.onMouseLeave,
  } satisfies CanvasFlowHandlers
}
