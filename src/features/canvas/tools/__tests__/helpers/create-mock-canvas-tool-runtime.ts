import type { CanvasToolRuntime } from '../../canvas-tool-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

export function createMockCanvasToolRuntime({
  deleteNodes = () => undefined,
  nodes = [],
}: {
  deleteNodes?: (nodeIds: ReadonlySet<string>) => void
  nodes?: Array<CanvasDocumentNode>
} = {}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode: () => undefined,
      patchNodeData: () => undefined,
      patchEdges: () => undefined,
      resizeNode: () => undefined,
      resizeNodes: () => undefined,
      deleteNodes,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePositions: () => undefined,
    },
    query: {
      getNodes: () => nodes,
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
      setSelection: () => undefined,
      clearSelection: () => undefined,
      toggleNode: () => undefined,
      toggleEdge: () => undefined,
      beginGesture: () => undefined,
      setGesturePreview: () => undefined,
      commitGesture: () => undefined,
      cancelGesture: () => undefined,
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
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'erase',
      setActiveTool: () => undefined,
      setEdgeType: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence: () => undefined,
      },
    },
  }
}
