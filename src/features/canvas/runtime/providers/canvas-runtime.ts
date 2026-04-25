import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasDragController } from '../../system/canvas-drag-controller'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
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
  canvasEngine: CanvasEngine
  remoteHighlights: ReadonlyMap<string, RemoteHighlight>
  history: CanvasHistoryController
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  nodeDragController: CanvasDragController | null
  viewportController: CanvasViewportController
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
const READ_ONLY_CANVAS_ENGINE = createCanvasEngine()

export const READ_ONLY_CANVAS_RUNTIME: CanvasRuntime = {
  canEdit: false,
  canvasEngine: READ_ONLY_CANVAS_ENGINE,
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
    patchNodeData: () => undefined,
    patchEdges: () => undefined,
    resizeNode: () => undefined,
    deleteNodes: () => undefined,
    createEdge: () => undefined,
    deleteEdges: () => undefined,
    setNodePositions: () => undefined,
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
    transact: (fn) => fn(),
    onResize: () => undefined,
    onResizeEnd: () => undefined,
  },
  nodeDragController: null,
  viewportController: {
    getViewport: () => READ_ONLY_CANVAS_ENGINE.getSnapshot().viewport,
    getZoom: () => READ_ONLY_CANVAS_ENGINE.getSnapshot().viewport.zoom,
    screenToCanvasPosition: (position) => position,
    canvasToScreenPosition: (position) => position,
    handleWheel: () => undefined,
    handlePanPointerDown: () => undefined,
    panBy: () => undefined,
    zoomBy: () => undefined,
    zoomTo: () => undefined,
    zoomIn: () => undefined,
    zoomOut: () => undefined,
    fitView: () => undefined,
    syncFromDocumentOrAdapter: () => undefined,
    commit: () => undefined,
    destroy: () => undefined,
  },
  selection: {
    getSnapshot: () => EMPTY_SELECTION_SNAPSHOT,
    setSelection: () => undefined,
    clearSelection: () => undefined,
    toggleNode: () => undefined,
    toggleEdge: () => undefined,
    beginGesture: () => undefined,
    setGesturePreview: () => undefined,
    commitGesture: () => undefined,
    cancelGesture: () => undefined,
  },
}
