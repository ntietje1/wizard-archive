import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
} from '../../tools/canvas-tool-types'
import {
  CanvasEditSessionContext,
  CanvasHistoryContext,
  CanvasNodeActionsContext,
  CanvasPermissionsContext,
  CanvasRemoteHighlightsContext,
} from './canvas-runtime-hooks'

interface CanvasProvidersProps {
  canEdit: boolean
  remoteHighlights: Map<string, RemoteHighlight>
  history: CanvasHistoryController
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  children: React.ReactNode
}

export function CanvasProviders({
  canEdit,
  remoteHighlights,
  history,
  editSession,
  nodeActions,
  children,
}: CanvasProvidersProps) {
  return (
    <CanvasPermissionsContext value={canEdit}>
      <CanvasHistoryContext value={history}>
        <CanvasEditSessionContext value={editSession}>
          <CanvasNodeActionsContext value={nodeActions}>
            <CanvasRemoteHighlightsContext value={remoteHighlights}>
              {children}
            </CanvasRemoteHighlightsContext>
          </CanvasNodeActionsContext>
        </CanvasEditSessionContext>
      </CanvasHistoryContext>
    </CanvasPermissionsContext>
  )
}
