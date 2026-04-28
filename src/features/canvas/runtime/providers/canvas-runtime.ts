import { createContext, useContext } from 'react'
import type { Context } from 'react'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'

export interface CanvasDocumentServices {
  history: CanvasHistoryController
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  nodeActions: CanvasNodeActions
}

export interface CanvasInteractionServices {
  canEdit: boolean
  editSession: CanvasEditSessionState
  selection: CanvasSelectionController
  viewportController: CanvasViewportController
}

export interface CanvasPresenceServices {
  remoteHighlights: ReadonlyMap<string, RemoteHighlight>
}

export const CanvasDomRuntimeContext = createContext<CanvasDomRuntime | null>(null)
export const CanvasDocumentServicesContext = createContext<CanvasDocumentServices | null>(null)
export const CanvasInteractionServicesContext = createContext<CanvasInteractionServices | null>(
  null,
)
export const CanvasPresenceServicesContext = createContext<CanvasPresenceServices | null>(null)

CanvasDomRuntimeContext.displayName = 'CanvasDomRuntimeContext'
CanvasDocumentServicesContext.displayName = 'CanvasDocumentServicesContext'
CanvasInteractionServicesContext.displayName = 'CanvasInteractionServicesContext'
CanvasPresenceServicesContext.displayName = 'CanvasPresenceServicesContext'

function createServiceHook<TService>(
  context: Context<TService | null>,
  hookName: string,
): () => TService {
  return () => {
    const services = useContext(context)
    if (services === null) {
      throw new Error(`${hookName} must be used within CanvasRuntimeProvider`)
    }

    return services
  }
}

export const useCanvasDomRuntime = createServiceHook<CanvasDomRuntime>(
  CanvasDomRuntimeContext,
  'useCanvasDomRuntime',
)
export const useCanvasDocumentServices = createServiceHook<CanvasDocumentServices>(
  CanvasDocumentServicesContext,
  'useCanvasDocumentServices',
)
export const useCanvasInteractionServices = createServiceHook<CanvasInteractionServices>(
  CanvasInteractionServicesContext,
  'useCanvasInteractionServices',
)
export const useCanvasPresenceServices = createServiceHook<CanvasPresenceServices>(
  CanvasPresenceServicesContext,
  'useCanvasPresenceServices',
)
