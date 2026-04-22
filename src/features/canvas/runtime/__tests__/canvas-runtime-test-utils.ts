import { vi } from 'vitest'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type { CanvasRemoteDragAnimation } from '../interaction/use-canvas-remote-drag-animation'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'

export function createCanvasSessionRuntime(): CanvasSessionRuntime {
  return {
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: vi.fn(),
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: vi.fn(),
      setPendingEditNodePoint: vi.fn(),
    },
    awareness: {
      remoteUsers: [],
      core: {
        setLocalCursor: vi.fn(),
        setLocalDragging: vi.fn(),
        setLocalResizing: vi.fn(),
        setLocalSelection: vi.fn(),
      },
      presence: {
        setPresence: vi.fn(),
      },
    },
    remoteUsers: [],
    remoteDragPositions: {},
    remoteResizeDimensions: {},
    remoteHighlights: new Map(),
  }
}

export function createCanvasSelectionController(): CanvasSelectionController {
  return {
    replace: vi.fn(),
    replaceNodes: vi.fn(),
    replaceEdges: vi.fn(),
    clear: vi.fn(),
    getSelectedNodeIds: vi.fn(() => []),
    getSelectedEdgeIds: vi.fn(() => []),
    toggleNodeFromTarget: vi.fn(),
    toggleEdgeFromTarget: vi.fn(),
    beginGesture: vi.fn(),
    commitGestureSelection: vi.fn(),
    endGesture: vi.fn(),
  }
}

export function createCanvasDocumentWriter(): CanvasDocumentWriter {
  return {
    createNode: vi.fn(),
    updateNode: vi.fn(),
    updateNodeData: vi.fn(),
    resizeNode: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePosition: vi.fn(),
  }
}

export function createCanvasRemoteDragAnimation(): CanvasRemoteDragAnimation {
  return {
    hasSpring: vi.fn(() => false),
    setTarget: vi.fn(),
    clearNodeSprings: vi.fn(),
  }
}

export function createCanvasProviderProps(
  overrides: Partial<{
    canEdit: boolean
    remoteHighlights: Map<string, RemoteHighlight>
    history: {
      canUndo: boolean
      canRedo: boolean
      undo: () => void
      redo: () => void
    }
    editSession: CanvasSessionRuntime['editSession']
    nodeActions: {
      updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
      transact?: (fn: () => void) => void
      onResize: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => void
      onResizeEnd: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => void
    }
  }> = {},
) {
  const {
    history: historyOverrides,
    editSession: editSessionOverrides,
    nodeActions: nodeActionsOverrides,
    ...restOverrides
  } = overrides

  return {
    canEdit: true,
    remoteHighlights: new Map(),
    history: {
      canUndo: false,
      canRedo: false,
      undo: () => undefined,
      redo: () => undefined,
      ...historyOverrides,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
      ...editSessionOverrides,
    },
    nodeActions: {
      updateNodeData: () => undefined,
      onResize: () => undefined,
      onResizeEnd: () => undefined,
      ...nodeActionsOverrides,
    },
    ...restOverrides,
  }
}
