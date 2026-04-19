import type { RefObject } from 'react'
import { useCanvasDocumentProjection } from './useCanvasDocumentProjection'
import { useCanvasDocumentWriter } from './useCanvasDocumentWriter'
import { useCanvasHistory } from './useCanvasHistory'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import type { CanvasRemoteDragAnimation } from './useCanvasRemoteDragAnimation'
import type { ResizingState } from '../utils/canvas-awareness-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDocumentRuntimeOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  localDraggingIdsRef: RefObject<Set<string>>
  remoteResizeDimensions: ResizingState
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasDocumentRuntime({
  nodesMap,
  edgesMap,
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

  const history = useCanvasHistory({ nodesMap, edgesMap })
  useCanvasKeyboardShortcuts(history)

  return {
    documentWriter,
    history,
  }
}
