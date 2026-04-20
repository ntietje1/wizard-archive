import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasCursorPresence } from './use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './use-canvas-drop-integration'
import type { useCanvasHistory } from '../document/use-canvas-history'
import { useCanvasNodeDragHandlers } from './use-canvas-node-drag-handlers'
import { useCanvasPointerBridge } from './use-canvas-pointer-bridge'
import { useCanvasSelectionRect } from '../selection/use-canvas-selection-rect'
import { useCanvasSurfaceClickGuard } from './use-canvas-surface-click-guard'
import { useCanvasSelectionSync } from '../selection/use-canvas-selection-sync'
import { useCanvasToolRuntime } from './use-canvas-tool-runtime'
import { useCanvasWheel } from './use-canvas-wheel'
import { useCanvasPreview } from '~/features/previews/hooks/use-canvas-preview'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasDocumentWriter,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasInteractionRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  activeToolId: CanvasToolId
  doc: Y.Doc
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  session: CanvasSessionRuntime
  selectionController: CanvasSelectionController
  documentWriter: CanvasDocumentWriter
  history: ReturnType<typeof useCanvasHistory>
  localDraggingIdsRef: RefObject<Set<string>>
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasInteractionRuntime({
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  activeToolId,
  doc,
  nodesMap,
  edgesMap,
  canvasSurfaceRef,
  session,
  selectionController,
  documentWriter,
  history,
  localDraggingIdsRef,
  remoteDragAnimation,
}: UseCanvasInteractionRuntimeOptions) {
  const reactFlowInstance = useReactFlow()
  const isSelectMode = activeToolId === 'select'
  const documentRead = {
    getNodes: () => reactFlowInstance.getNodes(),
    getEdges: () => reactFlowInstance.getEdges(),
  }
  const interaction = useCanvasSurfaceClickGuard(canvasSurfaceRef)

  useCanvasSelectionRect({
    surfaceRef: canvasSurfaceRef,
    awareness: session.awareness.presence,
    selection: selectionController,
    interaction,
    enabled: canEdit && isSelectMode,
  })

  useCanvasSelectionSync({
    setLocalSelection: session.awareness.core.setLocalSelection,
    onHistorySelectionChange: history.onSelectionChange,
  })

  const { activeToolController, toolCursor } = useCanvasToolRuntime({
    documentRead,
    documentWrite: documentWriter,
    selection: selectionController,
    interaction,
    awareness: session.awareness,
    editSession: session.editSession,
  })

  useCanvasPreview({
    canvasId,
    doc,
    containerRef: canvasSurfaceRef,
  })

  useCanvasPointerBridge({
    surfaceRef: canvasSurfaceRef,
    activeToolController,
  })

  useCanvasWheel(canvasSurfaceRef)

  const { dropOverlayRef, isDropTarget, isFileDropTarget } = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
  })

  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance,
    localDraggingIdsRef,
  })

  const { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave } = useCanvasCursorPresence({
    reactFlowInstance,
    awareness: session.awareness.core,
  })

  const nodeActions = useMemo(
    () => ({
      updateNodeData: documentWriter.updateNodeData,
      onResize: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => {
        reactFlowInstance.setNodes((current) =>
          current.map((node) => (node.id === nodeId ? { ...node, width, height, position } : node)),
        )
        session.awareness.core.setLocalResizing({
          [nodeId]: { width, height, x: position.x, y: position.y },
        })
      },
      onResizeEnd: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => {
        session.awareness.core.setLocalResizing(null)
        documentWriter.resizeNode(nodeId, width, height, position)
      },
    }),
    [documentWriter, reactFlowInstance, session.awareness.core],
  )

  const shellProps: CanvasFlowShellProps = {
    chrome: {
      toolCursor,
      remoteUsers: session.remoteUsers,
      activeTool: activeToolId,
      dropTarget: {
        overlayRef: dropOverlayRef,
        isTarget: isDropTarget,
        isFileTarget: isFileDropTarget,
      },
    },
    canvasSurfaceRef,
    contextMenu: {
      campaignId,
      canvasParentId,
      nodesMap,
      edgesMap,
      createNode: documentWriter.createNode,
      screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
      selectionController,
    },
    flowHandlers: {
      onNodeDragStart: isSelectMode ? onNodeDragStart : undefined,
      onNodeDrag: isSelectMode ? onNodeDrag : undefined,
      onNodeDragStop: isSelectMode ? onNodeDragStop : undefined,
      onNodesDelete: isSelectMode
        ? (deleted) => {
            documentWriter.deleteNodes(deleted.map((node) => node.id))
          }
        : undefined,
      onEdgesDelete: isSelectMode
        ? (deleted) => {
            documentWriter.deleteEdges(deleted.map((edge) => edge.id))
          }
        : undefined,
      onConnect: isSelectMode
        ? (connection) => {
            documentWriter.createEdge(connection)
          }
        : undefined,
      onMoveStart: activeToolController.onMoveStart,
      onMoveEnd: activeToolController.onMoveEnd,
      onNodeClick: activeToolController.onNodeClick,
      onEdgeClick: activeToolController.onEdgeClick,
      onPaneClick: activeToolController.onPaneClick,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  }

  return {
    shellProps,
    nodeActions,
  }
}
