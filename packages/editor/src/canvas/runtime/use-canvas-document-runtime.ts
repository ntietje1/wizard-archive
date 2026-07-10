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
import type { CanvasToolStore } from '../stores/canvas-tool-store'
import type { RefObject } from 'react'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'

interface UseCanvasDocumentRuntimeOptions {
  canEdit: boolean
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  canvasEngine: ReturnType<typeof createCanvasEngine>
  edgesMap: Y.Map<CanvasDocumentEdge>
  nodesMap: Y.Map<CanvasDocumentNode>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  toolStore: CanvasToolStore
}

export function useCanvasDocumentRuntime({
  canEdit,
  canvasSurfaceRef,
  canvasEngine,
  edgesMap,
  nodesMap,
  selection,
  session,
  toolStore,
}: UseCanvasDocumentRuntimeOptions) {
  const documentWriter = createCanvasDocumentWriter({
    canEdit,
    nodesMap,
    edgesMap,
  })
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
    surfaceRef: canvasSurfaceRef,
    nodesMap,
    edgesMap,
    selection,
    commands,
    toolStore,
  })

  const nodeActions = createCanvasNodeActions({
    canvasEngine,
    canEdit,
    documentWriter,
    session,
    transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
  })

  return {
    commands,
    documentWriter,
    history,
    nodeActions,
  }
}
