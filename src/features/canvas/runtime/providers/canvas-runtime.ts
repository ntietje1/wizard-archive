import { createContext, createElement, useContext } from 'react'
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

const CanvasCanEditContext = createContext<boolean | null>(null)
const CanvasCommandsContext = createContext<CanvasCommands | null>(null)
const CanvasDocumentWriterContext = createContext<CanvasDocumentWriter | null>(null)
const CanvasDomRuntimeContext = createContext<CanvasDomRuntime | null>(null)
const CanvasEditSessionContext = createContext<CanvasEditSessionState | null>(null)
const CanvasHistoryContext = createContext<CanvasHistoryController | null>(null)
const CanvasNodeActionsContext = createContext<CanvasNodeActions | null>(null)
const CanvasRemoteHighlightsContext = createContext<ReadonlyMap<string, RemoteHighlight> | null>(
  null,
)
const CanvasSelectionContext = createContext<CanvasSelectionController | null>(null)
const CanvasViewportControllerContext = createContext<CanvasViewportController | null>(null)

CanvasCanEditContext.displayName = 'CanvasCanEditContext'
CanvasCommandsContext.displayName = 'CanvasCommandsContext'
CanvasDocumentWriterContext.displayName = 'CanvasDocumentWriterContext'
CanvasDomRuntimeContext.displayName = 'CanvasDomRuntimeContext'
CanvasEditSessionContext.displayName = 'CanvasEditSessionContext'
CanvasHistoryContext.displayName = 'CanvasHistoryContext'
CanvasNodeActionsContext.displayName = 'CanvasNodeActionsContext'
CanvasRemoteHighlightsContext.displayName = 'CanvasRemoteHighlightsContext'
CanvasSelectionContext.displayName = 'CanvasSelectionContext'
CanvasViewportControllerContext.displayName = 'CanvasViewportControllerContext'

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

export const useCanvasDomRuntime = createServiceHook<CanvasDomRuntime>(
  CanvasDomRuntimeContext,
  'useCanvasDomRuntime',
)

export const useCanvasDocumentWriter = createServiceHook<CanvasDocumentWriter>(
  CanvasDocumentWriterContext,
  'useCanvasDocumentWriter',
)

export const useCanvasHistory = createServiceHook<CanvasHistoryController>(
  CanvasHistoryContext,
  'useCanvasHistory',
)

export const useCanvasCommands = createServiceHook<CanvasCommands>(
  CanvasCommandsContext,
  'useCanvasCommands',
)

export const useCanvasNodeActions = createServiceHook<CanvasNodeActions>(
  CanvasNodeActionsContext,
  'useCanvasNodeActions',
)

export const useCanvasCanEdit = createServiceHook<boolean>(CanvasCanEditContext, 'useCanvasCanEdit')

export const useCanvasEditSession = createServiceHook<CanvasEditSessionState>(
  CanvasEditSessionContext,
  'useCanvasEditSession',
)

export const useCanvasSelection = createServiceHook<CanvasSelectionController>(
  CanvasSelectionContext,
  'useCanvasSelection',
)

export const useCanvasViewportController = createServiceHook<CanvasViewportController>(
  CanvasViewportControllerContext,
  'useCanvasViewportController',
)

export const useCanvasRemoteHighlights = createServiceHook<ReadonlyMap<string, RemoteHighlight>>(
  CanvasRemoteHighlightsContext,
  'useCanvasRemoteHighlights',
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
  let tree = children
  tree = provide(CanvasRemoteHighlightsContext, remoteHighlights, tree)
  tree = provide(CanvasViewportControllerContext, viewportController, tree)
  tree = provide(CanvasSelectionContext, selection, tree)
  tree = provide(CanvasEditSessionContext, editSession, tree)
  tree = provide(CanvasCanEditContext, canEdit, tree)
  tree = provide(CanvasNodeActionsContext, nodeActions, tree)
  tree = provide(CanvasCommandsContext, commands, tree)
  tree = provide(CanvasHistoryContext, history, tree)
  tree = provide(CanvasDocumentWriterContext, documentWriter, tree)
  return provide(CanvasDomRuntimeContext, domRuntime, tree)
}

function provide<TValue>(
  context: Context<TValue | null>,
  value: TValue,
  children: ReactNode,
): ReactNode {
  return createElement(context.Provider, { value }, children)
}
