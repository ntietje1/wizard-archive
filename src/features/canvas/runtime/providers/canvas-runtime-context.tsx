import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import {
  CanvasCommandsContext,
  CanvasDocumentWriterContext,
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
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  selection: CanvasSelectionController
  children: React.ReactNode
}

export function CanvasProviders({
  canEdit,
  remoteHighlights,
  history,
  commands,
  documentWriter,
  editSession,
  nodeActions,
  selection,
  children,
}: CanvasProvidersProps) {
  return (
    <CanvasPermissionsContext value={canEdit}>
      <CanvasHistoryContext value={history}>
        <CanvasCommandsContext value={commands}>
          <CanvasDocumentWriterContext value={documentWriter}>
            <CanvasEditSessionContext value={editSession}>
              <CanvasSelectionContext value={selection}>
                <CanvasNodeActionsContext value={nodeActions}>
                  <CanvasRemoteHighlightsContext value={remoteHighlights}>
                    {children}
                  </CanvasRemoteHighlightsContext>
                </CanvasNodeActionsContext>
              </CanvasSelectionContext>
            </CanvasEditSessionContext>
          </CanvasDocumentWriterContext>
        </CanvasCommandsContext>
      </CanvasHistoryContext>
    </CanvasPermissionsContext>
  )
}
