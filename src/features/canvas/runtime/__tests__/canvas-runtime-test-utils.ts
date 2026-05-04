import { vi } from 'vitest'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasDocumentServices, CanvasPresenceServices } from '../providers/canvas-runtime'
import type { CanvasRuntimeProviderProps } from '../providers/canvas-runtime-context'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'

export function createCanvasRuntimeEnginePair() {
  const domRuntime = createCanvasDomRuntime()
  const canvasEngine = createCanvasEngine({ domRuntime })
  return { canvasEngine, domRuntime }
}

function createCanvasSelectionController(): CanvasSelectionController {
  return {
    getSnapshot: vi.fn(() => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })),
    setSelection: vi.fn(),
    clearSelection: vi.fn(),
    toggleNode: vi.fn(),
    toggleEdge: vi.fn(),
    beginGesture: vi.fn(),
    setGesturePreview: vi.fn(),
    commitGesture: vi.fn(),
    cancelGesture: vi.fn(),
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
    arrange: {
      id: 'arrange',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
  }
}

function createCanvasDocumentWriter(): CanvasDocumentWriter {
  return {
    createNode: vi.fn(),
    patchNodeData: vi.fn(),
    patchEdges: vi.fn(),
    resizeNode: vi.fn(),
    resizeNodes: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePositions: vi.fn(),
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
    nodeActions: Partial<CanvasDocumentServices['nodeActions']>
    documentWriter: CanvasDocumentWriter
    selection: CanvasSelectionController
    canvasEngine: CanvasEngine
    domRuntime: CanvasDomRuntime
    viewportController: CanvasViewportController
    commands: CanvasCommands
  }> = {},
): Omit<CanvasRuntimeProviderProps, 'children'> & {
  canvasEngine: CanvasEngine
  canEdit: boolean
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  history: CanvasDocumentServices['history']
  nodeActions: CanvasDocumentServices['nodeActions']
  remoteHighlights: CanvasPresenceServices['remoteHighlights']
  selection: CanvasSelectionController
  viewportController: CanvasViewportController
  editSession: CanvasSessionRuntime['editSession']
} {
  const {
    history: historyOverrides,
    editSession: editSessionOverrides,
    nodeActions: nodeActionsOverrides,
    documentWriter: documentWriterOverrides,
    selection: selectionOverrides,
    commands: commandsOverrides,
    viewportController: viewportControllerOverrides,
    canvasEngine: canvasEngineOverride,
    domRuntime: domRuntimeOverride,
    remoteHighlights = new Map<string, RemoteHighlight>(),
    canEdit = true,
  } = overrides
  if (canvasEngineOverride && !domRuntimeOverride) {
    throw new Error('createCanvasRuntime requires domRuntime when canvasEngine is overridden')
  }

  const domRuntime = domRuntimeOverride ?? createCanvasDomRuntime()
  const canvasEngine = canvasEngineOverride ?? createCanvasEngine({ domRuntime })

  const history = {
    canUndo: false,
    canRedo: false,
    undo: () => undefined,
    redo: () => undefined,
    ...historyOverrides,
  }
  const editSession = {
    editingEmbedId: null,
    setEditingEmbedId: () => undefined,
    pendingEditNodeId: null,
    pendingEditNodePoint: null,
    setPendingEditNodeId: () => undefined,
    setPendingEditNodePoint: () => undefined,
    ...editSessionOverrides,
  }
  const nodeActions = {
    transact: (fn: () => void) => fn(),
    onResize: () => undefined,
    onResizeEnd: () => undefined,
    onResizeMany: () => undefined,
    onResizeManyCancel: () => undefined,
    onResizeManyEnd: () => undefined,
    ...nodeActionsOverrides,
  }
  const documentWriter = {
    ...createCanvasDocumentWriter(),
    ...documentWriterOverrides,
  }
  const selection = {
    ...createCanvasSelectionController(),
    ...selectionOverrides,
  }
  const viewportController = {
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    getZoom: vi.fn(() => 1),
    screenToCanvasPosition: vi.fn((position) => position),
    canvasToScreenPosition: vi.fn((position) => position),
    handleWheel: vi.fn(),
    handlePanPointerDown: vi.fn(),
    panBy: vi.fn(),
    zoomBy: vi.fn(),
    zoomTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    syncFromDocumentOrAdapter: vi.fn(),
    commit: vi.fn(),
    destroy: vi.fn(),
    ...viewportControllerOverrides,
  }
  const commands = {
    ...createCanvasCommands(),
    ...commandsOverrides,
  }
  const documentServices = {
    commands,
    documentWriter,
    history,
    nodeActions,
  }
  const interactionServices = {
    canEdit,
    editSession,
    selection,
    viewportController,
  }
  const presenceServices = {
    remoteHighlights,
  }

  return {
    canEdit,
    canvasEngine,
    domRuntime,
    documentServices,
    interactionServices,
    presenceServices,
    remoteHighlights,
    history,
    editSession,
    nodeActions,
    documentWriter,
    selection,
    viewportController,
    commands,
  }
}
