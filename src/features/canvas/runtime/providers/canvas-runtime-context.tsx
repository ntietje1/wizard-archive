import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import {
  CanvasEditSessionContext,
  CanvasHistoryContext,
  CanvasNodeActionsContext,
  CanvasPermissionsContext,
  CanvasRemoteHighlightsContext,
  CanvasSelectionContext,
} from './canvas-runtime-hooks'

interface CanvasProvidersProps {
  canEdit: boolean
  remoteHighlights: Map<string, RemoteHighlight>
  history: CanvasHistoryController
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  selection: CanvasSelectionController
  children: React.ReactNode
}

export function CanvasProviders({
  canEdit,
  remoteHighlights,
  history,
  editSession,
  nodeActions,
  selection,
  children,
}: CanvasProvidersProps) {
  return (
    <CanvasPermissionsContext value={canEdit}>
      <CanvasHistoryContext value={history}>
        <CanvasEditSessionContext value={editSession}>
          <CanvasSelectionContext value={selection}>
            <CanvasNodeActionsContext value={nodeActions}>
              <CanvasRemoteHighlightsContext value={remoteHighlights}>
                {children}
              </CanvasRemoteHighlightsContext>
            </CanvasNodeActionsContext>
          </CanvasSelectionContext>
        </CanvasEditSessionContext>
      </CanvasHistoryContext>
    </CanvasPermissionsContext>
  )
}
