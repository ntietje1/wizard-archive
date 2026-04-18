import { createContext, useContext } from 'react'
import type { RemoteHighlight } from '../utils/canvas-awareness-types'
import type {
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
} from '../tools/canvas-tool-types'

export interface CanvasRuntimeContextValue {
  canEdit: boolean
  user: RemoteHighlight
  remoteHighlights: Map<string, RemoteHighlight>
  history: CanvasHistoryController
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
}

export const CanvasRuntimeContext = createContext<CanvasRuntimeContextValue | null>(null)
CanvasRuntimeContext.displayName = 'CanvasRuntimeContext'

export function useCanvasRuntimeContext() {
  const runtime = useContext(CanvasRuntimeContext)
  if (!runtime) {
    throw new Error('useCanvasRuntimeContext must be used within CanvasProviders')
  }

  return runtime
}
