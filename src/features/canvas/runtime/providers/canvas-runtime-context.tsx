import { createContext, useContext } from 'react'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
} from '../../tools/canvas-tool-types'

export interface CanvasProviderValues {
  canEdit: boolean
  remoteHighlights: Map<string, RemoteHighlight>
  history: CanvasHistoryController
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
}

function createRequiredCanvasContext<TValue>(name: string) {
  const context = createContext<TValue | null>(null)
  context.displayName = name

  function useRequiredCanvasContext() {
    const value = useContext(context)
    if (value === null) {
      throw new Error(`${name} must be used within CanvasProviders`)
    }

    return value
  }

  return [context, useRequiredCanvasContext] as const
}

const [CanvasPermissionsContext, useCanvasPermissionsContext] =
  createRequiredCanvasContext<boolean>('CanvasPermissionsContext')

const [CanvasHistoryContext, useCanvasHistoryContext] =
  createRequiredCanvasContext<CanvasHistoryController>('CanvasHistoryContext')

const [CanvasEditSessionContext, useCanvasEditSessionContext] =
  createRequiredCanvasContext<CanvasEditSessionState>('CanvasEditSessionContext')

const [CanvasNodeActionsContext, useCanvasNodeActionsContext] =
  createRequiredCanvasContext<CanvasNodeActions>('CanvasNodeActionsContext')

const [CanvasRemoteHighlightsContext, useCanvasRemoteHighlightsContext] =
  createRequiredCanvasContext<Map<string, RemoteHighlight>>('CanvasRemoteHighlightsContext')

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

export {
  useCanvasPermissionsContext,
  useCanvasHistoryContext,
  useCanvasEditSessionContext,
  useCanvasNodeActionsContext,
  useCanvasRemoteHighlightsContext,
}
