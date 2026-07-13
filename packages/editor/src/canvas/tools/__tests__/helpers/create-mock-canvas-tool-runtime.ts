import type { CanvasToolId, CanvasToolRuntime } from '../../canvas-tool-types'
import type { CanvasDocumentNode } from '../../../document-contract'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import type { CanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
export function createMockCanvasToolRuntime({
  activeTool = 'select',
  deleteNodes = () => undefined,
  localOverlayStore = createCanvasToolLocalOverlayStore(),
  nodes = [],
}: {
  activeTool?: CanvasToolId
  deleteNodes?: (nodeIds: ReadonlySet<string>) => void
  localOverlayStore?: CanvasToolLocalOverlayStore
  nodes?: Array<CanvasDocumentNode>
} = {}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      execute: (command) => ({
        type: 'completed',
        command: command.type,
        affectedCount: 0,
      }),
      createNode: () => undefined,
      createNodes: () => undefined,
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
      pendingEdit: null,
      setPendingEdit: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => activeTool,
      setActiveTool: () => undefined,
      setEdgeType: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    localOverlay: localOverlayStore.getState(),
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
