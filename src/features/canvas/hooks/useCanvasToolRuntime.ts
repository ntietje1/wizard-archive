import { useMemo, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getCanvasToolModule } from '../tools/canvas-tool-modules'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { getMeasuredCanvasNodesFromLookup } from './canvas-measured-nodes'
import type {
  CanvasAwarenessWriter,
  CanvasDocumentReader,
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasToolEnvironment,
  CanvasSelectionActions,
  CanvasToolStateControls,
} from '../tools/canvas-tool-types'
import type { DrawingState, Point2D } from '../utils/canvas-awareness-types'

interface UseCanvasToolRuntimeOptions {
  documentWriter: CanvasDocumentWriter
  documentReader: CanvasDocumentReader
  selectionActions: CanvasSelectionActions
  awareness: CanvasAwarenessWriter
  editSession: CanvasEditSessionState
}

export function useCanvasToolRuntime({
  documentWriter,
  documentReader,
  selectionActions,
  awareness,
  editSession,
}: UseCanvasToolRuntimeOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const setActiveTool = useCanvasToolStore((state) => state.setActiveTool)
  const setStrokeColor = useCanvasToolStore((state) => state.setStrokeColor)
  const setStrokeOpacity = useCanvasToolStore((state) => state.setStrokeOpacity)
  const setStrokeSize = useCanvasToolStore((state) => state.setStrokeSize)

  const documentWriterRef = useRef(documentWriter)
  documentWriterRef.current = documentWriter
  const documentReaderRef = useRef(documentReader)
  documentReaderRef.current = documentReader
  const selectionActionsRef = useRef(selectionActions)
  selectionActionsRef.current = selectionActions
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const editSessionRef = useRef(editSession)
  editSessionRef.current = editSession

  const toolStateControls = useMemo<CanvasToolStateControls>(
    () => ({
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
      setStrokeColor,
      setStrokeOpacity,
      setStrokeSize,
    }),
    [setActiveTool, setStrokeColor, setStrokeOpacity, setStrokeSize],
  )

  const viewportTools = useMemo(
    () => ({
      screenToFlowPosition: (position: { x: number; y: number }) =>
        reactFlow.screenToFlowPosition(position),
      getZoom: () => reactFlow.getZoom(),
    }),
    [reactFlow],
  )

  const awarenessWriter = useMemo<CanvasAwarenessWriter>(
    () => ({
      setLocalPresence: (namespace, value) =>
        awarenessRef.current.setLocalPresence(namespace, value),
      setLocalCursor: (position) => awarenessRef.current.setLocalCursor(position),
      setLocalDragging: (positions) => awarenessRef.current.setLocalDragging(positions),
      setLocalResizing: (resizing) => awarenessRef.current.setLocalResizing(resizing),
      setLocalSelection: (nodeIds) => awarenessRef.current.setLocalSelection(nodeIds),
      setLocalDrawing: (drawing) => awarenessRef.current.setLocalDrawing(drawing),
      setLocalSelecting: (selecting) => awarenessRef.current.setLocalSelecting(selecting),
    }),
    [],
  )

  const interactionOverlays = useMemo(
    () => ({
      setLocalDrawing: (drawing: DrawingState | null) => {
        useCanvasInteractionStore.getState().setLocalDrawing(drawing)
        awarenessRef.current.setLocalDrawing(drawing)
      },
      setLassoPath: (path: Array<Point2D>) =>
        useCanvasInteractionStore.getState().setLassoPath(path),
      setSelectionDragRect: (
        rect: { x: number; y: number; width: number; height: number } | null,
      ) => useCanvasInteractionStore.getState().setSelectionDragRect(rect),
      setErasingStrokeIds: (ids: Set<string>) =>
        useCanvasInteractionStore.getState().setErasingStrokeIds(ids),
      setRectDeselectedIds: (ids: Set<string>) =>
        useCanvasInteractionStore.getState().setRectDeselectedIds(ids),
    }),
    [],
  )

  const activeToolModule = getCanvasToolModule(activeTool)
  if (!activeToolModule) {
    throw new Error(
      `Missing canvas tool module for activeTool "${activeTool}" in canvasToolModuleMap.`,
    )
  }

  const environment = useMemo<CanvasToolEnvironment>(
    () => ({
      viewport: viewportTools,
      document: {
        createNode: (node) => documentWriterRef.current.createNode(node),
        updateNode: (nodeId, updater) => documentWriterRef.current.updateNode(nodeId, updater),
        updateNodeData: (nodeId, data) => documentWriterRef.current.updateNodeData(nodeId, data),
        resizeNode: (nodeId, width, height, position) =>
          documentWriterRef.current.resizeNode(nodeId, width, height, position),
        deleteNodes: (nodeIds) => documentWriterRef.current.deleteNodes(nodeIds),
        createEdge: (connection) => documentWriterRef.current.createEdge(connection),
        deleteEdges: (edgeIds) => documentWriterRef.current.deleteEdges(edgeIds),
        setNodePosition: (nodeId, position) =>
          documentWriterRef.current.setNodePosition(nodeId, position),
        getNodes: () => documentReaderRef.current.getNodes(),
        getEdges: () => documentReaderRef.current.getEdges(),
        getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
      },
      selection: {
        setNodeSelection: (nodeIds) => selectionActionsRef.current.setNodeSelection(nodeIds),
        clearSelection: () => selectionActionsRef.current.clearSelection(),
        getSelectedNodeIds: () => selectionActionsRef.current.getSelectedNodeIds(),
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
      toolState: toolStateControls,
      interaction: interactionOverlays,
      awareness: awarenessWriter,
    }),
    [awarenessWriter, interactionOverlays, storeApi, toolStateControls, viewportTools],
  )

  return useMemo(() => {
    return {
      activeTool,
      activeToolModule,
      activeToolController: activeToolModule.create(environment),
    }
  }, [activeTool, activeToolModule, environment])
}
