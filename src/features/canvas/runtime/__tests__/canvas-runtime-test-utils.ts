import { vi } from 'vitest'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'

function createCanvasSelectionController(): CanvasSelectionController {
  return {
    getSnapshot: vi.fn(() => ({ nodeIds: [], edgeIds: [] })),
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
    selection: CanvasSelectionController
  }> = {},
) {
  const {
    history: historyOverrides,
    editSession: editSessionOverrides,
    nodeActions: nodeActionsOverrides,
    selection: selectionOverrides,
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
    selection: {
      ...createCanvasSelectionController(),
      ...selectionOverrides,
    },
    ...restOverrides,
  }
}
