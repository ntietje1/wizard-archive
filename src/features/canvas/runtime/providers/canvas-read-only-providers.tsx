import { CanvasProviders } from './canvas-runtime-context'
import { CanvasRenderModeProvider } from './canvas-render-mode-context'
import type { CanvasRenderMode } from './canvas-render-mode-context'
import type {
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
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

const EMPTY_REMOTE_HIGHLIGHTS = new Map<string, never>()

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
        editSession={READ_ONLY_EDIT_SESSION}
        nodeActions={READ_ONLY_NODE_ACTIONS}
        remoteHighlights={EMPTY_REMOTE_HIGHLIGHTS}
      >
        {children}
      </CanvasProviders>
    </CanvasRenderModeProvider>
  )
}
