import { createContext, useContext } from 'react'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'

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

export const [CanvasPermissionsContext, useCanvasPermissionsContext] =
  createRequiredCanvasContext<boolean>('CanvasPermissionsContext')

export const [CanvasHistoryContext, useCanvasHistoryContext] =
  createRequiredCanvasContext<CanvasHistoryController>('CanvasHistoryContext')

export const [CanvasEditSessionContext, useCanvasEditSessionContext] =
  createRequiredCanvasContext<CanvasEditSessionState>('CanvasEditSessionContext')

export const [CanvasNodeActionsContext, useCanvasNodeActionsContext] =
  createRequiredCanvasContext<CanvasNodeActions>('CanvasNodeActionsContext')

export const [CanvasSelectionContext, useCanvasSelectionContext] =
  createRequiredCanvasContext<CanvasSelectionController>('CanvasSelectionContext')

export const [CanvasRemoteHighlightsContext, useCanvasRemoteHighlightsContext] =
  createRequiredCanvasContext<Map<string, RemoteHighlight>>('CanvasRemoteHighlightsContext')

export const [CanvasCommandsContext, useCanvasCommandsContext] =
  createRequiredCanvasContext<CanvasCommands>('CanvasCommandsContext')

export const [CanvasDocumentWriterContext, useCanvasDocumentWriterContext] =
  createRequiredCanvasContext<CanvasDocumentWriter>('CanvasDocumentWriterContext')
