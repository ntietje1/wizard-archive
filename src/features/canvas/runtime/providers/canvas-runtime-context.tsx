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

export interface CanvasProviderValues {
  canEdit: boolean
  remoteHighlights: Map<string, RemoteHighlight>
  history: CanvasHistoryController
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
}

export function CanvasProviders({
  runtime,
  children,
}: {
  runtime: CanvasProviderValues
  children: React.ReactNode
}) {
  return (
    <CanvasPermissionsContext value={runtime.canEdit}>
      <CanvasHistoryContext value={runtime.history}>
        <CanvasEditSessionContext value={runtime.editSession}>
          <CanvasNodeActionsContext value={runtime.nodeActions}>
            <CanvasRemoteHighlightsContext value={runtime.remoteHighlights}>
              {children}
            </CanvasRemoteHighlightsContext>
          </CanvasNodeActionsContext>
        </CanvasEditSessionContext>
      </CanvasHistoryContext>
    </CanvasPermissionsContext>
  )
}
