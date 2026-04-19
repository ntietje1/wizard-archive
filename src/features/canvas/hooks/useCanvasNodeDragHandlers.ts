import { useCallback } from 'react'
import { logger } from '~/shared/utils/logger'
import type { OnNodeDrag, ReactFlowInstance } from '@xyflow/react'
import type { RefObject } from 'react'
import type { CanvasCoreAwarenessWriter, CanvasDocumentWriter } from '../tools/canvas-tool-types'
import type { CanvasRemoteDragAnimation } from './useCanvasRemoteDragAnimation'
import type * as Y from 'yjs'

interface UseCanvasNodeDragHandlersOptions {
  documentWriter: CanvasDocumentWriter
  nodesDoc: Y.Doc | null | undefined
  remoteDragAnimation: CanvasRemoteDragAnimation
  awareness: CanvasCoreAwarenessWriter
  reactFlowInstance: ReactFlowInstance
  localDraggingIdsRef: RefObject<Set<string>>
}

export function useCanvasNodeDragHandlers({
  documentWriter,
  nodesDoc,
  remoteDragAnimation,
  awareness,
  reactFlowInstance,
  localDraggingIdsRef,
}: UseCanvasNodeDragHandlersOptions) {
  const onNodeDragStart: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      for (const draggedNode of nodes) {
        localDraggingIdsRef.current.add(draggedNode.id)
      }
    },
    [localDraggingIdsRef],
  )

  const onNodeDrag: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      awareness.setLocalDragging(
        Object.fromEntries(nodes.map((draggedNode) => [draggedNode.id, draggedNode.position])),
      )
      awareness.setLocalCursor(
        reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      )
    },
    [awareness, reactFlowInstance],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      for (const draggedNode of nodes) {
        localDraggingIdsRef.current.delete(draggedNode.id)
      }
      remoteDragAnimation.clearNodeSprings(nodes.map((draggedNode) => draggedNode.id))

      try {
        if (!nodesDoc) {
          logger.warn(
            'useCanvasNodeDragHandlers: missing Yjs doc during node drag stop; positions were not persisted',
          )
          return
        }

        nodesDoc.transact(() => {
          for (const draggedNode of nodes) {
            documentWriter.setNodePosition(draggedNode.id, draggedNode.position)
          }
        })
      } catch (error) {
        logger.error('useCanvasNodeDragHandlers: failed to persist node drag positions', error)
      } finally {
        awareness.setLocalDragging(null)
      }
    },
    [awareness, documentWriter, localDraggingIdsRef, nodesDoc, remoteDragAnimation],
  )

  return {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  }
}
