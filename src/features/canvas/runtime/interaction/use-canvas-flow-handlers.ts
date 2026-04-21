import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type { CanvasDocumentWriter, CanvasToolController } from '../../tools/canvas-tool-types'
import type { Connection, Edge, Node } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export function useCanvasFlowHandlers({
  activeToolController,
  canEdit,
  cursorPresence,
  documentWriter,
  dragHandlers,
  isSelectMode,
}: {
  activeToolController: CanvasToolController
  canEdit: boolean
  isSelectMode: boolean
  cursorPresence: {
    onMouseLeave: () => void
    onMouseMove: (event: ReactMouseEvent) => void
  }
  documentWriter: CanvasDocumentWriter
  dragHandlers: {
    onNodeDragStart: NonNullable<CanvasFlowShellProps['flowHandlers']['onNodeDragStart']>
    onNodeDrag: NonNullable<CanvasFlowShellProps['flowHandlers']['onNodeDrag']>
    onNodeDragStop: NonNullable<CanvasFlowShellProps['flowHandlers']['onNodeDragStop']>
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
    onMoveStart: activeToolController.onMoveStart,
    onMoveEnd: activeToolController.onMoveEnd,
    onNodeClick: activeToolController.onNodeClick,
    onEdgeClick: activeToolController.onEdgeClick,
    onPaneClick: activeToolController.onPaneClick,
    onMouseMove: cursorPresence.onMouseMove,
    onMouseLeave: cursorPresence.onMouseLeave,
  } satisfies CanvasFlowShellProps['flowHandlers']
}
