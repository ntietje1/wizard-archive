import { vi } from 'vitest'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasRuntime } from '../providers/canvas-runtime'
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

function createCanvasCommands(): CanvasCommands {
  return {
    copy: {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    cut: {
      id: 'cut',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    paste: {
      id: 'paste',
      canRun: vi.fn(() => false),
      run: vi.fn(() => null),
    },
    duplicate: {
      id: 'duplicate',
      canRun: vi.fn(() => true),
      run: vi.fn(() => null),
    },
    delete: {
      id: 'delete',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    reorder: {
      id: 'reorder',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
  }
}

function createCanvasDocumentWriter(): CanvasDocumentWriter {
  return {
    createNode: vi.fn(),
    updateNode: vi.fn(),
    updateNodeData: vi.fn(),
    updateEdge: vi.fn(),
    resizeNode: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePosition: vi.fn(),
  }
}

export function createCanvasRuntime(
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
    documentWriter: CanvasDocumentWriter
    selection: CanvasSelectionController
    commands: CanvasCommands
  }> = {},
): CanvasRuntime {
  const {
    history: historyOverrides,
    editSession: editSessionOverrides,
    nodeActions: nodeActionsOverrides,
    documentWriter: documentWriterOverrides,
    selection: selectionOverrides,
    commands: commandsOverrides,
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
    documentWriter: {
      ...createCanvasDocumentWriter(),
      ...documentWriterOverrides,
    },
    selection: {
      ...createCanvasSelectionController(),
      ...selectionOverrides,
    },
    commands: {
      ...createCanvasCommands(),
      ...commandsOverrides,
    },
    ...restOverrides,
  }
}
