import type { CanvasToolId, CanvasToolServices } from '../../canvas-tool-types'
import type { Node } from '@xyflow/react'

export function createMouseEvent(x: number, y: number): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
  } as React.MouseEvent
}

export function createPointerEvent(
  x: number,
  y: number,
  options: Partial<PointerEvent> = {},
): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: {
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    },
    ...options,
  } as PointerEvent
}

export function createPlacementEnvironment({
  activeTool,
  createNode,
  replaceSelection,
  setPendingEditNodeId,
  setPendingEditNodePoint = () => undefined,
  setActiveTool,
}: {
  activeTool: CanvasToolId
  createNode: (node: Node) => void
  replaceSelection: (selection: { nodeIds: Array<string>; edgeIds: Array<string> }) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setPendingEditNodePoint?: (point: { x: number; y: number } | null) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolServices {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
    },
    query: {
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      replace: replaceSelection,
      replaceNodes: (nodeIds) => replaceSelection({ nodeIds, edgeIds: [] }),
      replaceEdges: (edgeIds) => replaceSelection({ nodeIds: [], edgeIds }),
      clear: () => undefined,
      getSelectedNodeIds: () => [],
      getSelectedEdgeIds: () => [],
      toggleNodeFromTarget: () => undefined,
      toggleEdgeFromTarget: () => undefined,
      beginGesture: () => undefined,
      commitGestureSelection: () => undefined,
      endGesture: () => undefined,
    },
    interaction: {
      suppressNextSurfaceClick: () => undefined,
    },
    modifiers: {
      getShiftPressed: () => false,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId,
      setPendingEditNodePoint,
    },
    toolState: {
      getSettings: () => ({
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => activeTool,
      setActiveTool,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalDragging: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence: () => undefined,
      },
    },
  }
}
