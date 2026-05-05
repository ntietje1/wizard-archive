import { createContext, createElement, useContext, useMemo } from 'react'
import type { Context, ReactNode } from 'react'
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

export type CanvasRuntimeProviderProps = {
  canEdit: boolean
  children: ReactNode
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  domRuntime: CanvasDomRuntime
  editSession: CanvasEditSessionState
  history: CanvasHistoryController
  nodeActions: CanvasNodeActions
  remoteHighlights: ReadonlyMap<string, RemoteHighlight>
  selection: CanvasSelectionController
  viewportController: CanvasViewportController
}

interface CanvasDocumentRuntimeServices {
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  history: CanvasHistoryController
}

interface CanvasInteractionRuntimeServices {
  canEdit: boolean
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  selection: CanvasSelectionController
}

interface CanvasViewportRuntimeServices {
  domRuntime: CanvasDomRuntime
  viewportController: CanvasViewportController
}

interface CanvasCollaborationRuntimeServices {
  remoteHighlights: ReadonlyMap<string, RemoteHighlight>
}

const CanvasDocumentRuntimeContext = createContext<CanvasDocumentRuntimeServices | null>(null)
const CanvasInteractionRuntimeContext = createContext<CanvasInteractionRuntimeServices | null>(null)
const CanvasViewportRuntimeContext = createContext<CanvasViewportRuntimeServices | null>(null)
const CanvasCollaborationRuntimeContext = createContext<CanvasCollaborationRuntimeServices | null>(
  null,
)

CanvasDocumentRuntimeContext.displayName = 'CanvasDocumentRuntimeContext'
CanvasInteractionRuntimeContext.displayName = 'CanvasInteractionRuntimeContext'
CanvasViewportRuntimeContext.displayName = 'CanvasViewportRuntimeContext'
CanvasCollaborationRuntimeContext.displayName = 'CanvasCollaborationRuntimeContext'

function createServiceHook<TService>(
  context: Context<TService | null>,
  hookName: string,
): () => TService {
  return () => {
    const value = useContext(context)
    if (value === null) {
      throw new Error(`${hookName} must be used within CanvasRuntimeProvider`)
    }

    return value
  }
}

export const useCanvasDocumentRuntime = createServiceHook<CanvasDocumentRuntimeServices>(
  CanvasDocumentRuntimeContext,
  'useCanvasDocumentRuntime',
)

export const useCanvasInteractionRuntime = createServiceHook<CanvasInteractionRuntimeServices>(
  CanvasInteractionRuntimeContext,
  'useCanvasInteractionRuntime',
)

export const useCanvasViewportRuntime = createServiceHook<CanvasViewportRuntimeServices>(
  CanvasViewportRuntimeContext,
  'useCanvasViewportRuntime',
)

export const useCanvasCollaborationRuntime = createServiceHook<CanvasCollaborationRuntimeServices>(
  CanvasCollaborationRuntimeContext,
  'useCanvasCollaborationRuntime',
)

export function CanvasRuntimeProvider({
  canEdit,
  children,
  commands,
  documentWriter,
  domRuntime,
  editSession,
  history,
  nodeActions,
  remoteHighlights,
  selection,
  viewportController,
}: CanvasRuntimeProviderProps) {
  const documentServices = useMemo(
    () => ({ commands, documentWriter, history }),
    [commands, documentWriter, history],
  )
  const interactionServices = useMemo(
    () => ({ canEdit, editSession, nodeActions, selection }),
    [canEdit, editSession, nodeActions, selection],
  )
  const viewportServices = useMemo(
    () => ({ domRuntime, viewportController }),
    [domRuntime, viewportController],
  )
  const collaborationServices = useMemo(() => ({ remoteHighlights }), [remoteHighlights])
  let tree = children
  tree = provide(CanvasCollaborationRuntimeContext, collaborationServices, tree)
  tree = provide(CanvasViewportRuntimeContext, viewportServices, tree)
  tree = provide(CanvasInteractionRuntimeContext, interactionServices, tree)
  return provide(CanvasDocumentRuntimeContext, documentServices, tree)
}

function provide<TValue>(
  context: Context<TValue | null>,
  value: TValue,
  children: ReactNode,
): ReactNode {
  return createElement(context.Provider, { value }, children)
}
