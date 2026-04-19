import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasDocumentProjection } from './useCanvasDocumentProjection'
import { useCanvasDocumentWriter } from './useCanvasDocumentWriter'
import { useCanvasDropIntegration } from './useCanvasDropIntegration'
import { useCanvasCursorPresence } from './useCanvasCursorPresence'
import { useCanvasHistory } from './useCanvasHistory'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { useCanvasNodeDragHandlers } from './useCanvasNodeDragHandlers'
import { useCanvasPointerBridge } from './useCanvasPointerBridge'
import { useCanvasPreviewContainer } from './useCanvasPreviewContainer'
import { useCanvasRemoteDragAnimation } from './useCanvasRemoteDragAnimation'
import { useCanvasSelectionActions } from './useCanvasSelectionActions'
import { useCanvasSelectionRect } from './useCanvasSelectionRect'
import { clearCanvasSelectionState } from './useCanvasSelectionState'
import { useCanvasSelectionSync } from './useCanvasSelectionSync'
import { useCanvasSessionState } from './useCanvasSessionState'
import { useCanvasToolRuntime } from './useCanvasToolRuntime'
import { useCanvasWheel } from './useCanvasWheel'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasFlowShellProps } from '../components/canvas-flow-shell'
import type { CanvasRuntimeContextValue } from './canvas-runtime-context'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, OnConnect, OnEdgesDelete, OnNodesDelete } from '@xyflow/react'
import type * as Y from 'yjs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type { UseCanvasDropIntegrationOptions } from './useCanvasDropIntegration'

interface UseCanvasFlowControllerOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  provider: ConvexYjsProvider | null
  user: { name: string; color: string }
  doc: Y.Doc
}

interface CanvasFlowControllerResult {
  runtime: CanvasRuntimeContextValue
  shellProps: CanvasFlowShellProps
}

export function useCanvasFlowController({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  provider,
  user,
  doc,
}: UseCanvasFlowControllerOptions): CanvasFlowControllerResult {
  const reactFlowInstance = useReactFlow()
  const session = useCanvasSessionState({ provider, user })
  const activeToolId = useCanvasToolStore((state) => state.activeTool)

  const documentWriter = useCanvasDocumentWriter({ nodesMap, edgesMap })
  const selectionActions = useCanvasSelectionActions()
  const localDraggingIdsRef = useRef(new Set<string>())
  const remoteDragAnimation = useCanvasRemoteDragAnimation({
    localDraggingIdsRef,
    remoteDragPositions: session.remoteDragPositions,
  })

  useEffect(() => {
    return () => clearCanvasSelectionState()
  }, [canvasId])

  useCanvasDocumentProjection({
    nodesMap,
    edgesMap,
    localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
    remoteDragAnimation,
  })

  const history = useCanvasHistory({ nodesMap, edgesMap })
  useCanvasKeyboardShortcuts(history)

  useCanvasSelectionRect({
    setLocalSelecting: session.awareness.setLocalSelecting,
    setNodeSelection: selectionActions.setNodeSelection,
    enabled: canEdit && activeToolId === 'select',
  })

  useCanvasSelectionSync({
    setLocalSelection: session.awareness.setLocalSelection,
    onHistorySelectionChange: history.onSelectionChange,
  })

  const { activeToolController, activeToolModule } = useCanvasToolRuntime({
    documentWriter,
    documentReader: selectionActions,
    selectionActions,
    awareness: session.awareness,
    editSession: session.editSession,
  })

  const { wrapperRef, wrapperElement, wrapperCallbackRef } = useCanvasPreviewContainer({
    canvasId,
    doc,
  })

  useCanvasPointerBridge({
    wrapperElement,
    activeToolController,
  })

  useCanvasWheel(wrapperRef)

  const isSelectMode = activeToolId === 'select'
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
    awareness: session.awareness,
    reactFlowInstance,
    localDraggingIdsRef,
  })

  const handleNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      documentWriter.deleteNodes(deleted.map((node) => node.id))
    },
    [documentWriter],
  )

  const handleEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      documentWriter.deleteEdges(deleted.map((edge) => edge.id))
    },
    [documentWriter],
  )

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      documentWriter.createEdge(connection)
    },
    [documentWriter],
  )

  const { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave } = useCanvasCursorPresence({
    reactFlowInstance,
    awareness: session.awareness,
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
        session.awareness.setLocalResizing({
          [nodeId]: { width, height, x: position.x, y: position.y },
        })
      },
      onResizeEnd: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => {
        session.awareness.setLocalResizing(null)
        documentWriter.resizeNode(nodeId, width, height, position)
      },
    }),
    [documentWriter, session.awareness],
  )

  const runtime: CanvasRuntimeContextValue = useMemo(
    () => ({
      canEdit,
      user,
      remoteHighlights: session.remoteHighlights,
      history,
      editSession: session.editSession,
      nodeActions,
    }),
    [canEdit, history, nodeActions, session.editSession, session.remoteHighlights, user],
  )

  const shellProps: CanvasFlowShellProps = {
    toolCursor: activeToolModule.cursor,
    wrapperRef: wrapperCallbackRef,
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
    onPaneClick: activeToolController.onPaneClick,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    dropOverlayRef,
    isDropTarget,
    isFileDropTarget,
  }

  return {
    runtime,
    shellProps,
  }
}
