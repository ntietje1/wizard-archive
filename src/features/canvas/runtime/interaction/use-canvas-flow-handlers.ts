import type { CanvasDocumentWriter, CanvasToolHandlers } from '../../tools/canvas-tool-types'
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
  canEdit,
  cursorPresence,
  documentWriter,
  dragHandlers,
  isSelectMode,
}: {
  activeToolHandlers: CanvasToolHandlers
  canEdit: boolean
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
      canEdit && isSelectMode
        ? (connection: Connection) => {
            documentWriter.createEdge(connection)
          }
        : undefined,
    onMoveStart: activeToolHandlers.onMoveStart,
    onMoveEnd: activeToolHandlers.onMoveEnd,
    onNodeClick: activeToolHandlers.onNodeClick,
    onEdgeClick: activeToolHandlers.onEdgeClick,
    onPaneClick: activeToolHandlers.onPaneClick,
    onMouseMove: cursorPresence.onMouseMove,
    onMouseLeave: cursorPresence.onMouseLeave,
  } satisfies CanvasFlowHandlers
}
