import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import { createContext, useContext } from 'react'

export interface CanvasRuntime {
  canEdit: boolean
  remoteHighlights: ReadonlyMap<string, RemoteHighlight>
  history: CanvasHistoryController
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  selection: CanvasSelectionController
}

export const CanvasRuntimeContext = createContext<CanvasRuntime | null>(null)

CanvasRuntimeContext.displayName = 'CanvasRuntimeContext'

export function useCanvasRuntime(): CanvasRuntime {
  const runtime = useContext(CanvasRuntimeContext)
  if (runtime === null) {
    throw new Error('useCanvasRuntime must be used within CanvasRuntimeProvider')
  }

  return runtime
}

const EMPTY_REMOTE_HIGHLIGHTS = new Map<string, RemoteHighlight>() as ReadonlyMap<
  string,
  RemoteHighlight
>
const EMPTY_SELECTION_NODE_IDS = new Set<string>()
const EMPTY_SELECTION_EDGE_IDS = new Set<string>()
const EMPTY_SELECTION_SNAPSHOT = {
  nodeIds: EMPTY_SELECTION_NODE_IDS,
  edgeIds: EMPTY_SELECTION_EDGE_IDS,
}

export const READ_ONLY_CANVAS_RUNTIME: CanvasRuntime = {
  canEdit: false,
  remoteHighlights: EMPTY_REMOTE_HIGHLIGHTS,
  history: {
    canUndo: false,
    canRedo: false,
    undo: () => undefined,
    redo: () => undefined,
  },
  commands: {
    copy: {
      id: 'copy',
      canRun: () => false,
      run: () => false,
    },
    cut: {
      id: 'cut',
      canRun: () => false,
      run: () => false,
    },
    paste: {
      id: 'paste',
      canRun: () => false,
      run: () => null,
    },
    duplicate: {
      id: 'duplicate',
      canRun: () => false,
      run: () => null,
    },
    delete: {
      id: 'delete',
      canRun: () => false,
      run: () => false,
    },
    reorder: {
      id: 'reorder',
      canRun: () => false,
      run: () => false,
    },
  },
  documentWriter: {
    createNode: () => undefined,
    updateNode: () => undefined,
    updateNodeData: () => undefined,
    updateEdge: () => undefined,
    resizeNode: () => undefined,
    deleteNodes: () => undefined,
    createEdge: () => undefined,
    deleteEdges: () => undefined,
    setNodePosition: () => undefined,
  },
  editSession: {
    editingEmbedId: null,
    setEditingEmbedId: () => undefined,
    pendingEditNodeId: null,
    pendingEditNodePoint: null,
    setPendingEditNodeId: () => undefined,
    setPendingEditNodePoint: () => undefined,
  },
  nodeActions: {
    updateNodeData: () => undefined,
    transact: (fn) => fn(),
    onResize: () => undefined,
    onResizeEnd: () => undefined,
  },
  selection: {
    getSnapshot: () => EMPTY_SELECTION_SNAPSHOT,
    replace: () => undefined,
    replaceNodes: () => undefined,
    replaceEdges: () => undefined,
    clear: () => undefined,
    getSelectedNodeIds: () => EMPTY_SELECTION_NODE_IDS,
    getSelectedEdgeIds: () => EMPTY_SELECTION_EDGE_IDS,
    toggleNodeFromTarget: () => undefined,
    toggleEdgeFromTarget: () => undefined,
    beginGesture: () => undefined,
    commitGestureSelection: () => undefined,
    endGesture: () => undefined,
  },
}
