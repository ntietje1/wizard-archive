import { useMemo, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { getCanvasToolModule } from '../tools/canvas-tool-modules'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type {
  CanvasDocumentActions,
  CanvasEditSessionState,
  CanvasToolRuntime,
} from '../tools/canvas-tool-types'
import type {
  DrawingState,
  Point2D,
  RemoteUser,
  ResizingState,
  SelectingState,
} from '../utils/canvas-awareness-types'
import type { Id } from 'convex/_generated/dataModel'

interface UseCanvasToolRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  documentActions: CanvasDocumentActions
  awareness: {
    remoteUsers: Array<RemoteUser>
    setLocalCursor: (position: Point2D | null) => void
    setLocalDragging: (positions: Record<string, Point2D> | null) => void
    setLocalResizing: (resizing: ResizingState | null) => void
    setLocalSelection: (nodeIds: Array<string> | null) => void
    broadcastLocalDrawing: (drawing: DrawingState | null) => void
    setLocalSelecting: (selecting: SelectingState | null) => void
  }
  editSession: CanvasEditSessionState
}

export function useCanvasToolRuntime({
  canvasId,
  canEdit,
  documentActions,
  awareness,
  editSession,
}: UseCanvasToolRuntimeOptions) {
  const reactFlow = useReactFlow()
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const setActiveTool = useCanvasToolStore((state) => state.setActiveTool)
  const completeActiveToolAction = useCanvasToolStore((state) => state.completeActiveToolAction)
  const documentActionsRef = useRef(documentActions)
  documentActionsRef.current = documentActions
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const editSessionRef = useRef(editSession)
  editSessionRef.current = editSession

  const runtime = useMemo<CanvasToolRuntime>(
    () => ({
      canvasId,
      canEdit,
      getSettings: () => {
        const state = useCanvasToolStore.getState()
        return {
          strokeColor: state.strokeColor,
          strokeOpacity: state.strokeOpacity,
          strokeSize: state.strokeSize,
        }
      },
      getActiveTool: () => useCanvasToolStore.getState().activeTool,
      setActiveTool,
      completeActiveToolAction,
      screenToFlowPosition: (position) => reactFlow.screenToFlowPosition(position),
      getZoom: () => reactFlow.getZoom(),
      document: {
        createNode: (node) => documentActionsRef.current.createNode(node),
        updateNode: (nodeId, updater) => documentActionsRef.current.updateNode(nodeId, updater),
        updateNodeData: (nodeId, data) => documentActionsRef.current.updateNodeData(nodeId, data),
        resizeNode: (nodeId, width, height, position) =>
          documentActionsRef.current.resizeNode(nodeId, width, height, position),
        deleteNodes: (nodeIds) => documentActionsRef.current.deleteNodes(nodeIds),
        createEdge: (connection) => documentActionsRef.current.createEdge(connection),
        deleteEdges: (edgeIds) => documentActionsRef.current.deleteEdges(edgeIds),
        setNodePosition: (nodeId, position) =>
          documentActionsRef.current.setNodePosition(nodeId, position),
        setNodeSelection: (nodeIds) => documentActionsRef.current.setNodeSelection(nodeIds),
        clearSelection: () => documentActionsRef.current.clearSelection(),
        getNodes: () => documentActionsRef.current.getNodes(),
        getEdges: () => documentActionsRef.current.getEdges(),
      },
      interaction: {
        getLocalDrawing: () => useCanvasInteractionStore.getState().localDrawing,
        setLocalDrawing: (drawing) => useCanvasInteractionStore.getState().setLocalDrawing(drawing),
        getLassoPath: () => useCanvasInteractionStore.getState().lassoPath,
        setLassoPath: (path) => useCanvasInteractionStore.getState().setLassoPath(path),
        getSelectionRect: () => useCanvasInteractionStore.getState().selectionRect,
        setSelectionRect: (rect) => useCanvasInteractionStore.getState().setSelectionRect(rect),
        setErasingStrokeIds: (ids) => useCanvasInteractionStore.getState().setErasingStrokeIds(ids),
        setRectDeselectedIds: (ids) =>
          useCanvasInteractionStore.getState().setRectDeselectedIds(ids),
      },
      awareness: {
        setLocalCursor: (position) => awarenessRef.current.setLocalCursor(position),
        setLocalDragging: (positions) => awarenessRef.current.setLocalDragging(positions),
        setLocalResizing: (resizing) => awarenessRef.current.setLocalResizing(resizing),
        setLocalSelection: (nodeIds) => awarenessRef.current.setLocalSelection(nodeIds),
        broadcastLocalDrawing: (drawing) => awarenessRef.current.broadcastLocalDrawing(drawing),
        setLocalSelecting: (selecting) => awarenessRef.current.setLocalSelecting(selecting),
        get remoteUsers() {
          return awarenessRef.current.remoteUsers
        },
      },
      editSession: {
        get editingEmbedId() {
          return editSessionRef.current.editingEmbedId
        },
        setEditingEmbedId: (id) => editSessionRef.current.setEditingEmbedId(id),
        get pendingEditNodeId() {
          return editSessionRef.current.pendingEditNodeId
        },
        setPendingEditNodeId: (id) => editSessionRef.current.setPendingEditNodeId(id),
      },
    }),
    [canvasId, canEdit, completeActiveToolAction, reactFlow, setActiveTool],
  )

  const activeToolModule = getCanvasToolModule(activeTool)
  if (!activeToolModule) {
    throw new Error(
      `Missing canvas tool module for activeTool "${activeTool}" in canvasToolModuleMap.`,
    )
  }

  const activeToolController = useMemo(
    () => activeToolModule.create(runtime),
    [activeToolModule, runtime],
  )

  return {
    activeTool,
    activeToolModule,
    activeToolController,
  }
}
