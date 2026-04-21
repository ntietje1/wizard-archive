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
  CanvasSelectionController,
  CanvasToolController,
  CanvasToolServices,
  CanvasToolId,
} from '../../tools/canvas-tool-types'

interface UseCanvasToolRuntimeOptions {
  documentRead: CanvasDocumentReader
  documentWrite: CanvasDocumentWriter
  selection: CanvasSelectionController
  interaction: CanvasInteractionTools
  awareness: CanvasAwarenessWriter
  editSession: CanvasEditSessionState
}

type CanvasToolRuntimeState = UseCanvasToolRuntimeOptions & {
  modifiers: {
    shiftPressed: boolean
    primaryPressed: boolean
  }
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
  const modifiers = useCanvasModifierKeys()

  const runtimeStateRef = useRef<CanvasToolRuntimeState | null>(null)
  runtimeStateRef.current = {
    documentRead,
    documentWrite,
    selection,
    interaction,
    awareness,
    editSession,
    modifiers,
  }

  const services = useMemo<CanvasToolServices>(
    () => createCanvasToolServices(runtimeStateRef, reactFlow, storeApi),
    [reactFlow, storeApi],
  )
  const controllerRef = useRef<{
    toolId: CanvasToolId
    services: CanvasToolServices
    controller: CanvasToolController
  } | null>(null)

  if (
    !controllerRef.current ||
    controllerRef.current.toolId !== activeTool ||
    controllerRef.current.services !== services
  ) {
    controllerRef.current = {
      toolId: activeTool,
      services,
      controller: createCanvasToolController(activeTool, services),
    }
  }

  return {
    activeTool,
    toolCursor: getCanvasToolCursor(activeTool),
    activeToolController: controllerRef.current.controller,
  }
}

function createCanvasToolServices(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
  reactFlow: ReturnType<typeof useReactFlow>,
  storeApi: ReturnType<typeof useStoreApi>,
): CanvasToolServices {
  const getRuntimeState = () => readCanvasToolRuntimeState(runtimeStateRef)

  return {
    viewport: {
      screenToFlowPosition: (position) => reactFlow.screenToFlowPosition(position),
      getZoom: () => reactFlow.getZoom(),
    },
    document: {
      createNode: (node) => getRuntimeState().documentWrite.createNode(node),
      updateNode: (nodeId, updater) => getRuntimeState().documentWrite.updateNode(nodeId, updater),
      updateNodeData: (nodeId, data) =>
        getRuntimeState().documentWrite.updateNodeData(nodeId, data),
      resizeNode: (nodeId, width, height, position) =>
        getRuntimeState().documentWrite.resizeNode(nodeId, width, height, position),
      deleteNodes: (nodeIds) => getRuntimeState().documentWrite.deleteNodes(nodeIds),
      createEdge: (connection) => getRuntimeState().documentWrite.createEdge(connection),
      deleteEdges: (edgeIds) => getRuntimeState().documentWrite.deleteEdges(edgeIds),
      setNodePosition: (nodeId, position) =>
        getRuntimeState().documentWrite.setNodePosition(nodeId, position),
      getNodes: () => getRuntimeState().documentRead.getNodes(),
      getEdges: () => getRuntimeState().documentRead.getEdges(),
      getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
    },
    selection: {
      replace: (selection) => getRuntimeState().selection.replace(selection),
      replaceNodes: (nodeIds) => getRuntimeState().selection.replaceNodes(nodeIds),
      replaceEdges: (edgeIds) => getRuntimeState().selection.replaceEdges(edgeIds),
      clear: () => getRuntimeState().selection.clear(),
      getSelectedNodeIds: () => getRuntimeState().selection.getSelectedNodeIds(),
      getSelectedEdgeIds: () => getRuntimeState().selection.getSelectedEdgeIds(),
      toggleNodeFromTarget: (targetId, toggle) =>
        getRuntimeState().selection.toggleNodeFromTarget(targetId, toggle),
      toggleEdgeFromTarget: (targetId, toggle) =>
        getRuntimeState().selection.toggleEdgeFromTarget(targetId, toggle),
      beginGesture: (kind) => getRuntimeState().selection.beginGesture(kind),
      commitGestureSelection: (selection, mode) =>
        getRuntimeState().selection.commitGestureSelection(selection, mode),
      endGesture: () => getRuntimeState().selection.endGesture(),
    },
    interaction: {
      suppressNextSurfaceClick: () => getRuntimeState().interaction.suppressNextSurfaceClick(),
    },
    modifiers: {
      getShiftPressed: () => getRuntimeState().modifiers.shiftPressed,
      getPrimaryPressed: () => getRuntimeState().modifiers.primaryPressed,
    },
    editSession: {
      get editingEmbedId() {
        return getRuntimeState().editSession.editingEmbedId
      },
      setEditingEmbedId: (id) => getRuntimeState().editSession.setEditingEmbedId(id),
      get pendingEditNodeId() {
        return getRuntimeState().editSession.pendingEditNodeId
      },
      get pendingEditNodePoint() {
        return getRuntimeState().editSession.pendingEditNodePoint
      },
      setPendingEditNodeId: (id) => getRuntimeState().editSession.setPendingEditNodeId(id),
      setPendingEditNodePoint: (point) =>
        getRuntimeState().editSession.setPendingEditNodePoint(point),
    },
    toolState: canvasToolStateControls,
    awareness: {
      core: {
        setLocalCursor: (position) => getRuntimeState().awareness.core.setLocalCursor(position),
        setLocalDragging: (positions) =>
          getRuntimeState().awareness.core.setLocalDragging(positions),
        setLocalResizing: (resizing) => getRuntimeState().awareness.core.setLocalResizing(resizing),
        setLocalSelection: (nodeIds) => getRuntimeState().awareness.core.setLocalSelection(nodeIds),
      },
      presence: {
        setPresence: (namespace, value) =>
          getRuntimeState().awareness.presence.setPresence(namespace, value),
      },
    },
  }
}

function readCanvasToolRuntimeState(
  runtimeStateRef: RefObject<CanvasToolRuntimeState | null>,
): CanvasToolRuntimeState {
  const runtimeState = runtimeStateRef.current
  if (!runtimeState) {
    throw new Error('Canvas tool runtime services were used before initialization')
  }

  return runtimeState
}
