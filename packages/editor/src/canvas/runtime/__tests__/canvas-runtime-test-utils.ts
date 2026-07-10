import { vi } from 'vite-plus/test'
import type {
  CanvasDocumentWriter,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../../../notes/runtime'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { buildWikiLinkAutocompleteModelFromSource } from '../../../notes/wiki-link/autocomplete-model'
import type { WikiLinkAutocompleteItemSource } from '../../../notes/wiki-link/autocomplete-model'
import type { WikiLinkAutocompleteModelData } from '../../../notes/wiki-link/autocomplete-source'
import type {
  NoteValueReferences,
  NoteValueRuntimeStateSource,
} from '../../../notes/value-runtime-model'

const EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE: WikiLinkAutocompleteItemSource = {
  getItemBreadcrumbs: () => '',
  getItemLinkPath: () => [],
  queryItems: () => [],
  resolveFolderPath: () => null,
  resolveItemPath: () => null,
  resolveNotePath: () => null,
}

const EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA: WikiLinkAutocompleteModelData = {
  context: null,
  headingsPending: false,
  model: buildWikiLinkAutocompleteModelFromSource({
    context: null,
    headings: [],
    itemSource: EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE,
    values: [],
  }),
  valuesPending: false,
}

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
    execute: vi.fn((command) => ({
      type: 'completed' as const,
      command: command.type,
      affectedCount: 0,
    })),
    createNode: vi.fn(),
    createNodes: vi.fn(),
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

function createTestEmbeddedNoteContentSource(): EmbeddedNoteContentSource {
  return {}
}

function createTestNoteEmbedTargetSource(): NoteEmbedTargetContentSource {
  return {
    embedTargetOperations: undefined,
  }
}

function createTestNoteLinkNavigationSource(): NoteLinkNavigationSource | null {
  return null
}

function createTestNoteLinkResolutionSource(): NoteLinkResolutionSource {
  return {
    revision: 'test',
    resolveItemPath: () => null,
  }
}

function createTestNoteValueReferences(): NoteValueReferences {
  return {
    getNoteCandidates: () => [],
    resolveNoteIdByPath: () => null,
  }
}

function createTestNoteValueStateSource(): NoteValueRuntimeStateSource {
  return {
    useNoteValueStates: () => ({
      states: [],
      status: 'success',
    }),
  }
}

function createTestNoteDocumentContentSource(): NoteDocumentContentSource {
  return {
    useNoteCollaborationSession: () => ({
      instanceId: 'test-note-session',
      mode: 'editable',
      reason: 'missing_collaboration_engine',
      status: 'unavailable',
      user: { color: '#000', name: 'Test User' },
    }),
  }
}

function createTestNotePlaybackContentSource(): NotePlaybackContentSource {
  return {}
}

function createTestNoteSharingContentSource(): NoteSharingContentSource {
  return {
    blocks: { status: 'unsupported', reason: 'not_available' },
  }
}

function createTestNoteWikiLinkContentSource(): NoteWikiLinkContentSource {
  return {
    useWikiLinkAutocompleteModelData: () => EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA,
  }
}

function createTestNotePermissionContentSource(): NotePermissionContentSource {
  return {
    canAccessItem: () => true,
    getMemberItemPermissionLevel: () => PERMISSION_LEVEL.FULL_ACCESS,
    selectedViewAsPlayerId: undefined,
  }
}

export function createCanvasRuntime(
  overrides: Partial<{
    canEdit: boolean
    remoteNodeHighlights: Map<string, RemoteHighlight>
    remoteEdgeHighlights: Map<string, RemoteHighlight>
    history: {
      canUndo: boolean
      canRedo: boolean
      undo: () => void
      redo: () => void
    }
    editSession: CanvasSessionRuntime['editSession']
    nodeActions: Partial<CanvasNodeActions>
    documentWriter: CanvasDocumentWriter
    selection: CanvasSelectionController
    canvasEngine: CanvasEngine
    domRuntime: CanvasDomRuntime
    viewportController: CanvasViewportController
    commands: CanvasCommands
    isSidebarItemEmbedRichTextEditable: (itemId: SidebarItemId) => boolean
    noteDocumentSource: NoteDocumentContentSource
    noteEmbeddedNoteContentSource: EmbeddedNoteContentSource
    noteEmbedTargetSource: NoteEmbedTargetContentSource
    noteLinkCreationSource: NoteLinkCreationSource | null
    noteLinkNavigationSource: NoteLinkNavigationSource | null
    noteLinkResolutionSource: NoteLinkResolutionSource
    notePlaybackSource: NotePlaybackContentSource
    notePermissionSource: NotePermissionContentSource
    noteSharingSource: NoteSharingContentSource
    noteValueReferences: NoteValueReferences
    noteValueStateSource: NoteValueRuntimeStateSource
    noteWikiLinkSource: NoteWikiLinkContentSource
  }> = {},
): {
  canvasEngine: CanvasEngine
  canEdit: boolean
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  domRuntime: CanvasDomRuntime
  history: CanvasHistoryController
  isSidebarItemEmbedRichTextEditable: (itemId: SidebarItemId) => boolean
  noteDocumentSource: NoteDocumentContentSource
  noteEmbeddedNoteContentSource: EmbeddedNoteContentSource
  noteEmbedTargetSource: NoteEmbedTargetContentSource
  noteLinkCreationSource: NoteLinkCreationSource | null
  noteLinkNavigationSource: NoteLinkNavigationSource | null
  noteLinkResolutionSource: NoteLinkResolutionSource
  notePlaybackSource: NotePlaybackContentSource
  notePermissionSource: NotePermissionContentSource
  noteSharingSource: NoteSharingContentSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  noteWikiLinkSource: NoteWikiLinkContentSource
  nodeActions: CanvasNodeActions
  remoteNodeHighlights: ReadonlyMap<string, RemoteHighlight>
  remoteEdgeHighlights: ReadonlyMap<string, RemoteHighlight>
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
    remoteNodeHighlights = new Map<string, RemoteHighlight>(),
    remoteEdgeHighlights = new Map<string, RemoteHighlight>(),
    canEdit = true,
    isSidebarItemEmbedRichTextEditable = () => false,
    noteDocumentSource = createTestNoteDocumentContentSource(),
    noteEmbeddedNoteContentSource = createTestEmbeddedNoteContentSource(),
    noteEmbedTargetSource = createTestNoteEmbedTargetSource(),
    noteLinkCreationSource = null,
    noteLinkNavigationSource = createTestNoteLinkNavigationSource(),
    noteLinkResolutionSource = createTestNoteLinkResolutionSource(),
    notePlaybackSource = createTestNotePlaybackContentSource(),
    notePermissionSource = createTestNotePermissionContentSource(),
    noteSharingSource = createTestNoteSharingContentSource(),
    noteValueReferences = createTestNoteValueReferences(),
    noteValueStateSource = createTestNoteValueStateSource(),
    noteWikiLinkSource = createTestNoteWikiLinkContentSource(),
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
    setZoomBounds: vi.fn(),
    commit: vi.fn(),
    destroy: vi.fn(),
    ...viewportControllerOverrides,
  }
  const commands = {
    ...createCanvasCommands(),
    ...commandsOverrides,
  }
  return {
    canEdit,
    canvasEngine,
    commands,
    documentWriter,
    domRuntime,
    history,
    isSidebarItemEmbedRichTextEditable,
    noteDocumentSource,
    noteEmbeddedNoteContentSource,
    noteEmbedTargetSource,
    noteLinkCreationSource,
    noteLinkNavigationSource,
    noteLinkResolutionSource,
    notePlaybackSource,
    notePermissionSource,
    noteSharingSource,
    noteValueReferences,
    noteValueStateSource,
    noteWikiLinkSource,
    editSession,
    nodeActions,
    remoteNodeHighlights,
    remoteEdgeHighlights,
    selection,
    viewportController,
  }
}
