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
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { UseCanvasDropIntegrationOptions } from './use-canvas-drop-integration'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type { OnConnect, OnEdgesDelete, OnNodesDelete } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasInteractionRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  activeToolId: CanvasFlowShellProps['activeTool']
  doc: Y.Doc
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
  canEdit,
  activeToolId,
  doc,
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

  const dropIntegrationOptions: UseCanvasDropIntegrationOptions = {
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
  }
  const { dropOverlayRef, isDropTarget, isFileDropTarget } =
    useCanvasDropIntegration(dropIntegrationOptions)

  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance,
    localDraggingIdsRef,
  })

  const handleNodesDelete: OnNodesDelete = (deleted) => {
    documentWriter.deleteNodes(deleted.map((node) => node.id))
  }

  const handleEdgesDelete: OnEdgesDelete = (deleted) => {
    documentWriter.deleteEdges(deleted.map((edge) => edge.id))
  }

  const handleConnect: OnConnect = (connection) => {
    documentWriter.createEdge(connection)
  }

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
    [documentWriter, session.awareness.core],
  )

  const shellProps: CanvasFlowShellProps = {
    toolCursor,
    canvasSurfaceRef,
    remoteUsers: session.remoteUsers,
    activeTool: activeToolId,
    onNodeDragStart: isSelectMode ? onNodeDragStart : undefined,
    onNodeDrag: isSelectMode ? onNodeDrag : undefined,
    onNodeDragStop: isSelectMode ? onNodeDragStop : undefined,
    onNodesDelete: isSelectMode ? handleNodesDelete : undefined,
    onEdgesDelete: isSelectMode ? handleEdgesDelete : undefined,
    onConnect: isSelectMode ? handleConnect : undefined,
    onMoveStart: activeToolController.onMoveStart,
    onMoveEnd: activeToolController.onMoveEnd,
    onNodeClick: activeToolController.onNodeClick,
    onEdgeClick: activeToolController.onEdgeClick,
    onPaneClick: activeToolController.onPaneClick,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    dropOverlayRef,
    isDropTarget,
    isFileDropTarget,
  }

  return {
    shellProps,
    nodeActions,
  }
}
