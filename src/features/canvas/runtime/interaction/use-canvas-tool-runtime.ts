import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { createCanvasToolController, getCanvasToolCursor } from '../../tools/canvas-tool-modules'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { canvasToolStateControls } from '../../stores/canvas-tool-state-controls'
import { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import { useCanvasModifierKeys } from './use-canvas-modifier-keys'
import type {
  CanvasAwarenessWriter,
  CanvasDocumentReader,
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasInteractionTools,
  CanvasModifierKeyReader,
  CanvasSelectionController,
  CanvasToolStateControls,
  CanvasToolServices,
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

type CanvasToolRuntimeState = UseCanvasToolRuntimeOptions

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
  const modifiers = useCanvasModifierKeys()

  const runtimeStateRef = useRef<CanvasToolRuntimeState | null>(null)
  const modifierStateRef = useRef(modifiers)
  runtimeStateRef.current = {
    documentRead,
    documentWrite,
    selection,
    interaction,
    awareness,
    editSession,
  }
  modifierStateRef.current = modifiers

  const services = useMemo<CanvasToolServices>(
    () =>
      createCanvasToolServices(
        runtimeStateRef,
        modifierStateRef,
        reactFlow,
        storeApi,
        canvasToolStateControls,
      ),
    [reactFlow, storeApi],
  )

  return useMemo(() => {
    return {
      activeTool,
      toolCursor: getCanvasToolCursor(activeTool),
      activeToolController: createCanvasToolController(activeTool, services),
    }
  }, [activeTool, services])
}

function createCanvasToolServices(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
  modifierStateRef: RefObject<{ shiftPressed: boolean; primaryPressed: boolean }>,
  reactFlow: ReturnType<typeof useReactFlow>,
  storeApi: ReturnType<typeof useStoreApi>,
  toolState: CanvasToolStateControls,
): CanvasToolServices {
  return {
    viewport: createCanvasViewportService(reactFlow),
    document: createCanvasDocumentService(runtimeStateRef, storeApi),
    selection: createCanvasSelectionService(runtimeStateRef),
    interaction: createCanvasInteractionService(runtimeStateRef),
    modifiers: createCanvasModifierService(modifierStateRef),
    editSession: createCanvasEditSessionService(runtimeStateRef),
    toolState,
    awareness: createCanvasAwarenessService(runtimeStateRef),
  }
}

function createCanvasViewportService(
  reactFlow: ReturnType<typeof useReactFlow>,
): CanvasViewportTools {
  return {
    screenToFlowPosition: (position) => reactFlow.screenToFlowPosition(position),
    getZoom: () => reactFlow.getZoom(),
  }
}

function createCanvasDocumentService(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
  storeApi: ReturnType<typeof useStoreApi>,
): CanvasToolServices['document'] {
  return {
    createNode: (node) => getRuntimeState(runtimeStateRef).documentWrite.createNode(node),
    updateNode: (nodeId, updater) =>
      getRuntimeState(runtimeStateRef).documentWrite.updateNode(nodeId, updater),
    updateNodeData: (nodeId, data) =>
      getRuntimeState(runtimeStateRef).documentWrite.updateNodeData(nodeId, data),
    resizeNode: (nodeId, width, height, position) =>
      getRuntimeState(runtimeStateRef).documentWrite.resizeNode(nodeId, width, height, position),
    deleteNodes: (nodeIds) => getRuntimeState(runtimeStateRef).documentWrite.deleteNodes(nodeIds),
    createEdge: (connection) =>
      getRuntimeState(runtimeStateRef).documentWrite.createEdge(connection),
    deleteEdges: (edgeIds) => getRuntimeState(runtimeStateRef).documentWrite.deleteEdges(edgeIds),
    setNodePosition: (nodeId, position) =>
      getRuntimeState(runtimeStateRef).documentWrite.setNodePosition(nodeId, position),
    getNodes: () => getRuntimeState(runtimeStateRef).documentRead.getNodes(),
    getEdges: () => getRuntimeState(runtimeStateRef).documentRead.getEdges(),
    getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
  }
}

function createCanvasSelectionService(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasSelectionController {
  return {
    replace: (selection) => getRuntimeState(runtimeStateRef).selection.replace(selection),
    replaceNodes: (nodeIds) => getRuntimeState(runtimeStateRef).selection.replaceNodes(nodeIds),
    replaceEdges: (edgeIds) => getRuntimeState(runtimeStateRef).selection.replaceEdges(edgeIds),
    clear: () => getRuntimeState(runtimeStateRef).selection.clear(),
    getSelectedNodeIds: () => getRuntimeState(runtimeStateRef).selection.getSelectedNodeIds(),
    getSelectedEdgeIds: () => getRuntimeState(runtimeStateRef).selection.getSelectedEdgeIds(),
    toggleNodeFromTarget: (targetId, toggle) =>
      getRuntimeState(runtimeStateRef).selection.toggleNodeFromTarget(targetId, toggle),
    toggleEdgeFromTarget: (targetId, toggle) =>
      getRuntimeState(runtimeStateRef).selection.toggleEdgeFromTarget(targetId, toggle),
    beginGesture: (kind) => getRuntimeState(runtimeStateRef).selection.beginGesture(kind),
    commitGestureSelection: (selection, mode) =>
      getRuntimeState(runtimeStateRef).selection.commitGestureSelection(selection, mode),
    endGesture: () => getRuntimeState(runtimeStateRef).selection.endGesture(),
  }
}

function createCanvasInteractionService(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasInteractionTools {
  return {
    suppressNextSurfaceClick: () =>
      getRuntimeState(runtimeStateRef).interaction.suppressNextSurfaceClick(),
  }
}

function createCanvasModifierService(
  modifierStateRef: RefObject<{ shiftPressed: boolean; primaryPressed: boolean }>,
): CanvasModifierKeyReader {
  return {
    getShiftPressed: () => modifierStateRef.current.shiftPressed,
    getPrimaryPressed: () => modifierStateRef.current.primaryPressed,
  }
}

function createCanvasEditSessionService(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasEditSessionState {
  return {
    get editingEmbedId() {
      return getRuntimeState(runtimeStateRef).editSession.editingEmbedId
    },
    setEditingEmbedId: (id) => getRuntimeState(runtimeStateRef).editSession.setEditingEmbedId(id),
    get pendingEditNodeId() {
      return getRuntimeState(runtimeStateRef).editSession.pendingEditNodeId
    },
    get pendingEditNodePoint() {
      return getRuntimeState(runtimeStateRef).editSession.pendingEditNodePoint
    },
    setPendingEditNodeId: (id) =>
      getRuntimeState(runtimeStateRef).editSession.setPendingEditNodeId(id),
    setPendingEditNodePoint: (point) =>
      getRuntimeState(runtimeStateRef).editSession.setPendingEditNodePoint(point),
  }
}

function createCanvasAwarenessService(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasAwarenessWriter {
  return {
    core: {
      setLocalCursor: (position) =>
        getRuntimeState(runtimeStateRef).awareness.core.setLocalCursor(position),
      setLocalDragging: (positions) =>
        getRuntimeState(runtimeStateRef).awareness.core.setLocalDragging(positions),
      setLocalResizing: (resizing) =>
        getRuntimeState(runtimeStateRef).awareness.core.setLocalResizing(resizing),
      setLocalSelection: (nodeIds) =>
        getRuntimeState(runtimeStateRef).awareness.core.setLocalSelection(nodeIds),
    },
    presence: {
      setPresence: (namespace, value) =>
        getRuntimeState(runtimeStateRef).awareness.presence.setPresence(namespace, value),
    },
  }
}

function getRuntimeState(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasToolRuntimeState {
  const runtimeState = runtimeStateRef.current
  if (!runtimeState) {
    throw new Error('Canvas tool runtime services were used before initialization')
  }

  return runtimeState
}
