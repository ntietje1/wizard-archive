import { CanvasProviders } from './canvas-runtime-context'
import { CanvasRenderModeProvider } from './canvas-render-mode-context'
import type { CanvasRenderMode } from './canvas-render-mode-context'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'

const READ_ONLY_HISTORY: CanvasHistoryController = {
  canUndo: false,
  canRedo: false,
  undo: () => undefined,
  redo: () => undefined,
}

const READ_ONLY_EDIT_SESSION: CanvasEditSessionState = {
  editingEmbedId: null,
  setEditingEmbedId: () => undefined,
  pendingEditNodeId: null,
  pendingEditNodePoint: null,
  setPendingEditNodeId: () => undefined,
  setPendingEditNodePoint: () => undefined,
}

const READ_ONLY_NODE_ACTIONS: CanvasNodeActions = {
  updateNodeData: () => undefined,
  transact: (fn) => fn(),
  onResize: () => undefined,
  onResizeEnd: () => undefined,
}

const READ_ONLY_DOCUMENT_WRITER: CanvasDocumentWriter = {
  createNode: () => undefined,
  updateNode: () => undefined,
  updateNodeData: () => undefined,
  updateEdge: () => undefined,
  resizeNode: () => undefined,
  deleteNodes: () => undefined,
  createEdge: () => undefined,
  deleteEdges: () => undefined,
  setNodePosition: () => undefined,
}

const READ_ONLY_SELECTION: CanvasSelectionController = {
  getSnapshot: () => ({ nodeIds: [], edgeIds: [] }),
  replace: () => undefined,
  replaceNodes: () => undefined,
  replaceEdges: () => undefined,
  clear: () => undefined,
  getSelectedNodeIds: () => [],
  getSelectedEdgeIds: () => [],
  toggleNodeFromTarget: () => undefined,
  toggleEdgeFromTarget: () => undefined,
  beginGesture: () => undefined,
  commitGestureSelection: () => undefined,
  endGesture: () => undefined,
}

const EMPTY_REMOTE_HIGHLIGHTS = new Map<string, never>()
const READ_ONLY_COMMANDS: CanvasCommands = {
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
}

export function CanvasReadOnlyProviders({
  mode = 'embedded-readonly',
  children,
}: {
  mode?: CanvasRenderMode
  children: React.ReactNode
}) {
  return (
    <CanvasRenderModeProvider mode={mode}>
      <CanvasProviders
        canEdit={false}
        history={READ_ONLY_HISTORY}
        commands={READ_ONLY_COMMANDS}
        documentWriter={READ_ONLY_DOCUMENT_WRITER}
        editSession={READ_ONLY_EDIT_SESSION}
        nodeActions={READ_ONLY_NODE_ACTIONS}
        remoteHighlights={EMPTY_REMOTE_HIGHLIGHTS}
        selection={READ_ONLY_SELECTION}
      >
        {children}
      </CanvasProviders>
    </CanvasRenderModeProvider>
  )
}
