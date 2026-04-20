import type { RefObject } from 'react'
import { useCanvasDocumentProjection } from './use-canvas-document-projection'
import { useCanvasDocumentWriter } from './use-canvas-document-writer'
import { useCanvasHistory } from './use-canvas-history'
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasRemoteDragAnimation } from '../interaction/use-canvas-remote-drag-animation'
import type { ResizingState } from '../../utils/canvas-awareness-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDocumentRuntimeOptions {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
  localDraggingIdsRef: RefObject<Set<string>>
  remoteResizeDimensions: ResizingState
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasDocumentRuntime({
  canEdit,
  nodesMap,
  edgesMap,
  selection,
  localDraggingIdsRef,
  remoteResizeDimensions,
  remoteDragAnimation,
}: UseCanvasDocumentRuntimeOptions) {
  const documentWriter = useCanvasDocumentWriter({ nodesMap, edgesMap })

  useCanvasDocumentProjection({
    nodesMap,
    edgesMap,
    localDraggingIdsRef,
    remoteResizeDimensions,
    remoteDragAnimation,
  })

  const history = useCanvasHistory({ nodesMap, edgesMap, selection })
  useCanvasKeyboardShortcuts({
    ...history,
    canEdit,
    nodesMap,
    edgesMap,
    selection,
  })

  return {
    documentWriter,
    history,
  }
}
