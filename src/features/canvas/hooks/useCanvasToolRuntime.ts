import { useMemo, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getCanvasToolModule } from '../tools/canvas-tool-modules'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { assertNever } from '~/shared/utils/utils'
import type {
  CanvasAwarenessWriter,
  CanvasDocumentReader,
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasMeasuredNode,
  CanvasSelectionActions,
  CanvasToolContextById,
  CanvasToolStateControls,
} from '../tools/canvas-tool-types'
import type {
  DrawingState,
  Point2D,
  ResizingState,
  SelectingState,
} from '../utils/canvas-awareness-types'

interface UseCanvasToolRuntimeOptions {
  documentWriter: CanvasDocumentWriter
  documentReader: CanvasDocumentReader
  selectionActions: CanvasSelectionActions
  getSelectionSnapshot: () => Array<string>
  awareness: {
    setLocalCursor: (position: Point2D | null) => void
    setLocalDragging: (positions: Record<string, Point2D> | null) => void
    setLocalResizing: (resizing: ResizingState | null) => void
    setLocalSelection: (nodeIds: Array<string> | null) => void
    setLocalDrawing: (drawing: DrawingState | null) => void
    setLocalSelecting: (selecting: SelectingState | null) => void
  }
  editSession: CanvasEditSessionState
}

export function useCanvasToolRuntime({
  documentWriter,
  documentReader,
  selectionActions,
  getSelectionSnapshot,
  awareness,
  editSession,
}: UseCanvasToolRuntimeOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const setActiveTool = useCanvasToolStore((state) => state.setActiveTool)
  const completeActiveToolAction = useCanvasToolStore((state) => state.completeActiveToolAction)

  const documentWriterRef = useRef(documentWriter)
  documentWriterRef.current = documentWriter
  const documentReaderRef = useRef(documentReader)
  documentReaderRef.current = documentReader
  const selectionActionsRef = useRef(selectionActions)
  selectionActionsRef.current = selectionActions
  const getSelectionSnapshotRef = useRef(getSelectionSnapshot)
  getSelectionSnapshotRef.current = getSelectionSnapshot
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
      completeActiveToolAction,
    }),
    [completeActiveToolAction, setActiveTool],
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
    }),
    [],
  )

  const activeToolModule = getCanvasToolModule(activeTool)
  if (!activeToolModule) {
    throw new Error(
      `Missing canvas tool module for activeTool "${activeTool}" in canvasToolModuleMap.`,
    )
  }

  return useMemo(() => {
    switch (activeToolModule.id) {
      case 'select':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            getNodes: () => documentReaderRef.current.getNodes(),
            getEdges: () => documentReaderRef.current.getEdges(),
            setNodeSelection: (nodeIds) => selectionActionsRef.current.setNodeSelection(nodeIds),
            clearSelection: () => selectionActionsRef.current.clearSelection(),
            getSelectionSnapshot: () => getSelectionSnapshotRef.current(),
          } satisfies CanvasToolContextById['select']),
        }
      case 'hand':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            getActiveTool: toolStateControls.getActiveTool,
            completeActiveToolAction: toolStateControls.completeActiveToolAction,
          } satisfies CanvasToolContextById['hand']),
        }
      case 'draw':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            getSettings: toolStateControls.getSettings,
            createNode: (node) => documentWriterRef.current.createNode(node),
            setLocalDrawing: interactionOverlays.setLocalDrawing,
          } satisfies CanvasToolContextById['draw']),
        }
      case 'erase':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            getNodes: () => documentReaderRef.current.getNodes(),
            getEdges: () => documentReaderRef.current.getEdges(),
            deleteNodes: (nodeIds) => documentWriterRef.current.deleteNodes(nodeIds),
            setErasingStrokeIds: interactionOverlays.setErasingStrokeIds,
          } satisfies CanvasToolContextById['erase']),
        }
      case 'lasso':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            setNodeSelection: (nodeIds) => selectionActionsRef.current.setNodeSelection(nodeIds),
            clearSelection: () => selectionActionsRef.current.clearSelection(),
            completeActiveToolAction: toolStateControls.completeActiveToolAction,
            getMeasuredNodes: () =>
              Array.from(storeApi.getState().nodeLookup.values()).flatMap((internalNode) => {
                const width = internalNode.measured?.width
                const height = internalNode.measured?.height
                if (width === undefined || height === undefined) {
                  return []
                }

                const measuredNode = {
                  id: internalNode.id,
                  type: internalNode.type,
                  data: internalNode.data,
                  position: internalNode.position,
                  width,
                  height,
                } satisfies CanvasMeasuredNode

                return [measuredNode]
              }),
            setLassoPath: interactionOverlays.setLassoPath,
            setLocalSelecting: awarenessWriter.setLocalSelecting,
          } satisfies CanvasToolContextById['lasso']),
        }
      case 'rectangle':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            getSettings: toolStateControls.getSettings,
            completeActiveToolAction: toolStateControls.completeActiveToolAction,
            createNode: (node) => documentWriterRef.current.createNode(node),
            setSelectionDragRect: interactionOverlays.setSelectionDragRect,
          } satisfies CanvasToolContextById['rectangle']),
        }
      case 'text':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            createNode: (node) => documentWriterRef.current.createNode(node),
            completeActiveToolAction: toolStateControls.completeActiveToolAction,
            setPendingEditNodeId: (nodeId) => editSessionRef.current.setPendingEditNodeId(nodeId),
          } satisfies CanvasToolContextById['text']),
        }
      case 'sticky':
        return {
          activeTool,
          activeToolModule,
          activeToolController: activeToolModule.create({
            ...viewportTools,
            createNode: (node) => documentWriterRef.current.createNode(node),
            completeActiveToolAction: toolStateControls.completeActiveToolAction,
            setPendingEditNodeId: (nodeId) => editSessionRef.current.setPendingEditNodeId(nodeId),
          } satisfies CanvasToolContextById['sticky']),
        }
      default:
        return assertNever(activeToolModule)
    }
  }, [
    activeTool,
    activeToolModule,
    awarenessWriter,
    interactionOverlays,
    storeApi,
    toolStateControls,
    viewportTools,
  ])
}
