import { createContext, createElement, useContext } from 'react'
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

const CanvasPermissionsContext = createContext<boolean | null>(null)
CanvasPermissionsContext.displayName = 'CanvasPermissionsContext'

const CanvasHistoryContext = createContext<CanvasHistoryController | null>(null)
CanvasHistoryContext.displayName = 'CanvasHistoryContext'

const CanvasEditSessionContext = createContext<CanvasEditSessionState | null>(null)
CanvasEditSessionContext.displayName = 'CanvasEditSessionContext'

const CanvasNodeActionsContext = createContext<CanvasNodeActions | null>(null)
CanvasNodeActionsContext.displayName = 'CanvasNodeActionsContext'

const CanvasRemoteHighlightsContext = createContext<Map<string, RemoteHighlight> | null>(null)
CanvasRemoteHighlightsContext.displayName = 'CanvasRemoteHighlightsContext'

export function CanvasRuntimeProviders({
  value,
  children,
}: {
  value: CanvasProviderValues
  children: React.ReactNode
}) {
  return createElement(
    CanvasPermissionsContext,
    { value: value.canEdit },
    createElement(
      CanvasHistoryContext,
      { value: value.history },
      createElement(
        CanvasEditSessionContext,
        { value: value.editSession },
        createElement(
          CanvasNodeActionsContext,
          { value: value.nodeActions },
          createElement(CanvasRemoteHighlightsContext, { value: value.remoteHighlights }, children),
        ),
      ),
    ),
  )
}

export function useCanvasPermissions() {
  const canEdit = useContext(CanvasPermissionsContext)
  if (canEdit === null) {
    throw new Error('useCanvasPermissions must be used within CanvasProviders')
  }

  return canEdit
}

export function useCanvasHistoryContext() {
  const history = useContext(CanvasHistoryContext)
  if (!history) {
    throw new Error('useCanvasHistoryContext must be used within CanvasProviders')
  }

  return history
}

export function useCanvasEditSessionContext() {
  const editSession = useContext(CanvasEditSessionContext)
  if (!editSession) {
    throw new Error('useCanvasEditSessionContext must be used within CanvasProviders')
  }

  return editSession
}

export function useCanvasNodeActionsContext() {
  const nodeActions = useContext(CanvasNodeActionsContext)
  if (!nodeActions) {
    throw new Error('useCanvasNodeActionsContext must be used within CanvasProviders')
  }

  return nodeActions
}

export function useCanvasRemoteHighlightsContext() {
  const remoteHighlights = useContext(CanvasRemoteHighlightsContext)
  if (!remoteHighlights) {
    throw new Error('useCanvasRemoteHighlightsContext must be used within CanvasProviders')
  }

  return remoteHighlights
}
