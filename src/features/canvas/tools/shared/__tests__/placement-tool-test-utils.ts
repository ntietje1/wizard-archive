import type { CanvasToolEnvironment, CanvasToolId } from '../../canvas-tool-types'
import type { Node } from '@xyflow/react'

export function createMouseEvent(x: number, y: number): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
  } as React.MouseEvent
}

export function createPlacementEnvironment({
  activeTool,
  createNode,
  setNodeSelection,
  setPendingEditNodeId,
  setActiveTool,
}: {
  activeTool: CanvasToolId
  createNode: (node: Node) => void
  setNodeSelection: (nodeIds: Array<string>) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      setNodeSelection,
      clearSelection: () => undefined,
      getSelectedNodeIds: () => [],
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId,
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
