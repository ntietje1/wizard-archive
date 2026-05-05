import { useMemo } from 'react'
import type * as Y from 'yjs'
import { useCanvasDocumentCommands } from './document/use-canvas-commands'
import { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import { useCanvasHistory } from './document/use-canvas-history'
import { useCanvasKeyboardShortcuts } from './document/use-canvas-keyboard-shortcuts'
import { transactCanvasMaps } from './document/canvas-yjs-transactions'
import { createCanvasNodeActions } from './interaction/create-canvas-node-actions'
import type { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import type { useCanvasSessionState } from './session/use-canvas-session-state'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'

interface UseCanvasDocumentRuntimeOptions {
  canEdit: boolean
  canvasEngine: ReturnType<typeof createCanvasEngine>
  edgesMap: Y.Map<CanvasDocumentEdge>
  nodesMap: Y.Map<CanvasDocumentNode>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
}

export function useCanvasDocumentRuntime({
  canEdit,
  canvasEngine,
  edgesMap,
  nodesMap,
  selection,
  session,
}: UseCanvasDocumentRuntimeOptions) {
  const documentWriter = useMemo(
    () =>
      createCanvasDocumentWriter({
        nodesMap,
        edgesMap,
      }),
    [edgesMap, nodesMap],
  )
  const history = useCanvasHistory({
    nodesMap,
    edgesMap,
    selection,
  })
  const commands = useCanvasDocumentCommands({
    canEdit,
    nodesMap,
    edgesMap,
    selection,
  })

  useCanvasKeyboardShortcuts({
    undo: history.undo,
    redo: history.redo,
    canEdit,
    nodesMap,
    edgesMap,
    selection,
    commands,
  })

  const nodeActions = useMemo(
    () =>
      createCanvasNodeActions({
        canvasEngine,
        documentWriter,
        session,
        transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
      }),
    [canvasEngine, documentWriter, edgesMap, nodesMap, session],
  )

  return {
    commands,
    documentWriter,
    history,
    nodeActions,
  }
}
