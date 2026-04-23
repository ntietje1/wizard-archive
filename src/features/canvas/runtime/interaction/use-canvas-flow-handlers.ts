import type {
  CanvasDocumentWriter,
  CanvasEdgeCreationDefaults,
  CanvasToolHandlers,
} from '../../tools/canvas-tool-types'
import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesDelete,
  OnNodeDrag,
  OnNodesDelete,
} from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export interface CanvasFlowHandlers {
  onNodeDragStart?: OnNodeDrag
  onNodeDrag?: OnNodeDrag
  onNodeDragStop?: OnNodeDrag
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

export function useCanvasFlowHandlers({
  activeToolHandlers,
  cancelConnectionDraft,
  canEdit,
  cursorPresence,
  documentWriter,
  dragHandlers,
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
  dragHandlers: {
    onNodeDragStart: NonNullable<CanvasFlowHandlers['onNodeDragStart']>
    onNodeDrag: NonNullable<CanvasFlowHandlers['onNodeDrag']>
    onNodeDragStop: NonNullable<CanvasFlowHandlers['onNodeDragStop']>
  }
}) {
  return {
    onNodeDragStart: canEdit && isSelectMode ? dragHandlers.onNodeDragStart : undefined,
    onNodeDrag: canEdit && isSelectMode ? dragHandlers.onNodeDrag : undefined,
    onNodeDragStop: canEdit && isSelectMode ? dragHandlers.onNodeDragStop : undefined,
    onNodesDelete:
      canEdit && isSelectMode
        ? (deleted: Array<Node>) => {
            documentWriter.deleteNodes(deleted.map((node) => node.id))
          }
        : undefined,
    onEdgesDelete:
      canEdit && isSelectMode
        ? (deleted: Array<Edge>) => {
            documentWriter.deleteEdges(deleted.map((edge) => edge.id))
          }
        : undefined,
    onConnect:
      canEdit && isEdgeMode
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
