import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import {
  createCanvasToolController,
  getCanvasToolCursor,
} from '../../tools/canvas-tool-modules'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import type {
  CanvasAwarenessWriter,
  CanvasCoreAwarenessWriter,
  CanvasDocumentReader,
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasInteractionTools,
  CanvasSelectionController,
  CanvasToolEnvironment,
  CanvasToolStateControls,
  CanvasViewportTools,
} from '../../tools/canvas-tool-types'

interface UseCanvasToolRuntimeOptions {
  documentRead: CanvasDocumentReader
  documentWrite: CanvasDocumentWriter
  selection: CanvasSelectionController
  interaction: CanvasInteractionTools
  awareness: CanvasAwarenessWriter
  editSession: CanvasEditSessionState
}

export function useCanvasToolRuntime({
  documentRead,
  documentWrite,
  selection,
  interaction,
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

  const documentWriteRef = useCurrentValue(documentWrite)
  const documentReadRef = useCurrentValue(documentRead)
  const selectionRef = useCurrentValue(selection)
  const interactionRef = useCurrentValue(interaction)
  const awarenessRef = useCurrentValue(awareness)
  const editSessionRef = useCurrentValue(editSession)

  const toolStateControls = useMemo(
    () =>
      createCanvasToolStateControls(
        setActiveTool,
        setStrokeColor,
        setStrokeOpacity,
        setStrokeSize,
      ),
    [setActiveTool, setStrokeColor, setStrokeOpacity, setStrokeSize],
  )

  const viewportTools = useMemo(() => createCanvasViewportTools(reactFlow), [reactFlow])

  const awarenessWriter = useMemo<CanvasAwarenessWriter>(
    () => createCanvasAwarenessCommands(awarenessRef),
    [awarenessRef],
  )

  const environment = useMemo<CanvasToolEnvironment>(
    () => ({
      viewport: viewportTools,
      document: createCanvasDocumentAccess(documentWriteRef, documentReadRef, storeApi),
      selection: createCanvasSelectionAccess(selectionRef),
      interaction: createCanvasInteractionAccess(interactionRef),
      editSession: createCanvasEditSessionAccess(editSessionRef),
      toolState: toolStateControls,
      awareness: awarenessWriter,
    }),
    [
      awarenessWriter,
      documentReadRef,
      documentWriteRef,
      editSessionRef,
      interactionRef,
      selectionRef,
      storeApi,
      toolStateControls,
      viewportTools,
    ],
  )

  return useMemo(() => {
    return {
      activeTool,
      toolCursor: getCanvasToolCursor(activeTool),
      activeToolController: createCanvasToolController(activeTool, environment),
    }
  }, [activeTool, environment])
}

function useCurrentValue<TValue>(value: TValue): RefObject<TValue> {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function createCanvasToolStateControls(
  setActiveTool: CanvasToolStateControls['setActiveTool'],
  setStrokeColor: CanvasToolStateControls['setStrokeColor'],
  setStrokeOpacity: CanvasToolStateControls['setStrokeOpacity'],
  setStrokeSize: CanvasToolStateControls['setStrokeSize'],
): CanvasToolStateControls {
  return {
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
  }
}

function createCanvasViewportTools(
  reactFlow: ReturnType<typeof useReactFlow>,
): CanvasViewportTools {
  return {
    screenToFlowPosition: (position) => reactFlow.screenToFlowPosition(position),
    getZoom: () => reactFlow.getZoom(),
  }
}

function createCanvasDocumentAccess(
  documentWriteRef: RefObject<CanvasDocumentWriter>,
  documentReadRef: RefObject<CanvasDocumentReader>,
  storeApi: ReturnType<typeof useStoreApi>,
): CanvasToolEnvironment['document'] {
  return {
    createNode: (node) => documentWriteRef.current.createNode(node),
    updateNode: (nodeId, updater) => documentWriteRef.current.updateNode(nodeId, updater),
    updateNodeData: (nodeId, data) => documentWriteRef.current.updateNodeData(nodeId, data),
    resizeNode: (nodeId, width, height, position) =>
      documentWriteRef.current.resizeNode(nodeId, width, height, position),
    deleteNodes: (nodeIds) => documentWriteRef.current.deleteNodes(nodeIds),
    createEdge: (connection) => documentWriteRef.current.createEdge(connection),
    deleteEdges: (edgeIds) => documentWriteRef.current.deleteEdges(edgeIds),
    setNodePosition: (nodeId, position) =>
      documentWriteRef.current.setNodePosition(nodeId, position),
    getNodes: () => documentReadRef.current.getNodes(),
    getEdges: () => documentReadRef.current.getEdges(),
    getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
  }
}

function createCanvasSelectionAccess(
  selectionRef: RefObject<CanvasSelectionController>,
): CanvasSelectionController {
  return {
    replace: (nodeIds) => selectionRef.current.replace(nodeIds),
    clear: () => selectionRef.current.clear(),
    getSelectedNodeIds: () => selectionRef.current.getSelectedNodeIds(),
    toggleFromTarget: (targetId, toggle) => selectionRef.current.toggleFromTarget(targetId, toggle),
    beginGesture: (kind) => selectionRef.current.beginGesture(kind),
    commitGestureSelection: (nodeIds) => selectionRef.current.commitGestureSelection(nodeIds),
    endGesture: () => selectionRef.current.endGesture(),
  }
}

function createCanvasInteractionAccess(
  interactionRef: RefObject<CanvasInteractionTools>,
): CanvasInteractionTools {
  return {
    suppressNextSurfaceClick: () => interactionRef.current.suppressNextSurfaceClick(),
  }
}

function createCanvasEditSessionAccess(
  editSessionRef: RefObject<CanvasEditSessionState>,
): CanvasEditSessionState {
  return {
    get editingEmbedId() {
      return editSessionRef.current.editingEmbedId
    },
    setEditingEmbedId: (id) => editSessionRef.current.setEditingEmbedId(id),
    get pendingEditNodeId() {
      return editSessionRef.current.pendingEditNodeId
    },
    setPendingEditNodeId: (id) => editSessionRef.current.setPendingEditNodeId(id),
  }
}

function createCanvasAwarenessCommands(
  awarenessRef: RefObject<CanvasAwarenessWriter>,
): CanvasAwarenessWriter {
  return {
    core: createCanvasCoreAwarenessCommands(awarenessRef),
    presence: {
      setPresence: (namespace, value) => awarenessRef.current.presence.setPresence(namespace, value),
    },
  }
}

function createCanvasCoreAwarenessCommands(
  awarenessRef: RefObject<CanvasAwarenessWriter>,
): CanvasCoreAwarenessWriter {
  return {
    setLocalCursor: (position) => awarenessRef.current.core.setLocalCursor(position),
    setLocalDragging: (positions) => awarenessRef.current.core.setLocalDragging(positions),
    setLocalResizing: (resizing) => awarenessRef.current.core.setLocalResizing(resizing),
    setLocalSelection: (nodeIds) => awarenessRef.current.core.setLocalSelection(nodeIds),
  }
}
