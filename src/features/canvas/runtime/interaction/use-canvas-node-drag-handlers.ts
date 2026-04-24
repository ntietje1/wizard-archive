import { useCallback, useRef } from 'react'
import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import { clearCanvasDragSnapGuides, setCanvasDragSnapGuides } from './canvas-drag-snap-overlay'
import {
  getSnapThresholdForZoom,
  resolveCanvasDragSnap,
  withBoundsPosition,
} from './canvas-drag-snap-utils'
import { useCanvasModifierKeys } from './use-canvas-modifier-keys'
import { constrainPointToAxis } from '../../utils/canvas-constraint-utils'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import { logger } from '~/shared/utils/logger'
import type { Node, OnNodeDrag, ReactFlowInstance, XYPosition } from '@xyflow/react'
import type { RefObject } from 'react'
import type { CanvasCoreAwarenessWriter, CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
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
  const { shiftPressed, primaryPressed } = useCanvasModifierKeys()

  const dragSessionRef = useRef<{
    startPointer: { x: number; y: number }
    startPositions: Map<string, { x: number; y: number }>
    nodeIndexes: Map<string, number>
    nodeBounds: Map<string, { x: number; y: number; width: number; height: number }>
    lastResolvedPositions: Map<string, { x: number; y: number }>
    targetBounds: Array<{ x: number; y: number; width: number; height: number }>
  } | null>(null)

  const onNodeDragStart: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      measureCanvasPerformance(
        'canvas.drag.start',
        { draggedCount: nodes.length, totalCount: reactFlowInstance.getNodes().length },
        () => {
          for (const draggedNode of nodes) {
            localDraggingIdsRef.current.add(draggedNode.id)
          }

          if (!('clientX' in event) || !('clientY' in event)) {
            clearCanvasDragSnapGuides()
            return
          }

          const currentNodes = reactFlowInstance.getNodes()
          const startPositions = new Map(
            nodes.map((draggedNode) => [draggedNode.id, draggedNode.position]),
          )
          const nodeIndexes = new Map(currentNodes.map((node, index) => [node.id, index]))
          const nodeBounds = new Map(
            nodes.flatMap((draggedNode) => {
              const bounds = getCanvasNodeBounds(draggedNode)
              return bounds ? [[draggedNode.id, bounds] as const] : []
            }),
          )
          const draggedIds = new Set(nodes.map((draggedNode) => draggedNode.id))
          const targetBounds = currentNodes
            .filter((candidate) => candidate.type !== 'stroke' && !draggedIds.has(candidate.id))
            .flatMap((candidate) => {
              const bounds = getCanvasNodeBounds(candidate)
              return bounds ? [bounds] : []
            })

          dragSessionRef.current = {
            startPointer: reactFlowInstance.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
            startPositions,
            nodeIndexes,
            nodeBounds,
            lastResolvedPositions: new Map(startPositions),
            targetBounds,
          }
          clearCanvasDragSnapGuides()
        },
      )
    },
    [localDraggingIdsRef, reactFlowInstance],
  )

  const onNodeDrag: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      measureCanvasPerformance('canvas.drag.move', { draggedCount: nodes.length }, () => {
        if (!('clientX' in event) || !('clientY' in event)) {
          return
        }

        const dragSession = dragSessionRef.current
        if (!dragSession) {
          return
        }

        const currentPointer = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
        const constrainedPointer = shiftPressed
          ? constrainPointToAxis(dragSession.startPointer, currentPointer)
          : currentPointer
        const delta = {
          x: constrainedPointer.x - dragSession.startPointer.x,
          y: constrainedPointer.y - dragSession.startPointer.y,
        }
        const resolvedPositions = new Map(
          nodes.map((draggedNode) => {
            const startPosition =
              dragSession.startPositions.get(draggedNode.id) ?? draggedNode.position
            return [
              draggedNode.id,
              {
                x: startPosition.x + delta.x,
                y: startPosition.y + delta.y,
              },
            ] as const
          }),
        )

        if (primaryPressed && dragSession.targetBounds.length > 0) {
          const draggedBounds = nodes.flatMap((draggedNode) => {
            const bounds = dragSession.nodeBounds.get(draggedNode.id)
            const position = resolvedPositions.get(draggedNode.id)
            return bounds && position ? [withBoundsPosition(bounds, position)] : []
          })
          const snap = resolveCanvasDragSnap({
            draggedBounds,
            targetBounds: dragSession.targetBounds,
            threshold: getSnapThresholdForZoom(reactFlowInstance.getZoom()),
          })

          if (snap.guides.length > 0) {
            setCanvasDragSnapGuides(snap.guides)
          } else {
            clearCanvasDragSnapGuides()
          }

          for (const [nodeId, position] of resolvedPositions) {
            resolvedPositions.set(nodeId, {
              x: position.x + snap.xAdjustment,
              y: position.y + snap.yAdjustment,
            })
          }
        } else {
          clearCanvasDragSnapGuides()
        }

        dragSession.lastResolvedPositions = resolvedPositions
        reactFlowInstance.setNodes((currentNodes) =>
          applyResolvedDragPositions(currentNodes, resolvedPositions, dragSession.nodeIndexes),
        )
        awareness.setLocalDragging(Object.fromEntries(resolvedPositions))
        awareness.setLocalCursor(constrainedPointer)
      })
    },
    [awareness, primaryPressed, reactFlowInstance, shiftPressed],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      measureCanvasPerformance('canvas.drag.stop', { draggedCount: nodes.length }, () => {
        const resolvedPositions = dragSessionRef.current?.lastResolvedPositions

        for (const draggedNode of nodes) {
          localDraggingIdsRef.current.delete(draggedNode.id)
        }
        remoteDragAnimation.clearNodeSprings(new Set(nodes.map((draggedNode) => draggedNode.id)))
        clearCanvasDragSnapGuides()
        dragSessionRef.current = null

        try {
          if (!nodesDoc) {
            logger.warn(
              'useCanvasNodeDragHandlers: missing Yjs doc during node drag stop; positions were not persisted',
            )
            return
          }

          const persistedPositions = new Map<string, XYPosition>()
          for (const draggedNode of nodes) {
            persistedPositions.set(
              draggedNode.id,
              resolvedPositions?.get(draggedNode.id) ?? draggedNode.position,
            )
          }
          documentWriter.setNodePositions(persistedPositions)
        } catch (error) {
          logger.error('useCanvasNodeDragHandlers: failed to persist node drag positions', error)
        } finally {
          awareness.setLocalDragging(null)
        }
      })
    },
    [awareness, documentWriter, localDraggingIdsRef, nodesDoc, remoteDragAnimation],
  )

  return {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  }
}

function applyResolvedDragPositions(
  currentNodes: Array<Node>,
  resolvedPositions: ReadonlyMap<string, XYPosition>,
  nodeIndexes: ReadonlyMap<string, number>,
): Array<Node> {
  if (resolvedPositions.size === 0) {
    return currentNodes
  }

  const nextNodes = currentNodes.slice()
  let changed = false

  for (const [nodeId, position] of resolvedPositions) {
    const indexedNodeIndex = nodeIndexes.get(nodeId)
    const indexedNode = indexedNodeIndex === undefined ? undefined : nextNodes[indexedNodeIndex]
    const nodeIndex =
      indexedNode?.id === nodeId
        ? indexedNodeIndex
        : nextNodes.findIndex((candidate) => candidate.id === nodeId)

    if (nodeIndex === undefined || nodeIndex < 0) {
      continue
    }

    const node = nextNodes[nodeIndex]
    if (node.position.x === position.x && node.position.y === position.y) {
      continue
    }

    nextNodes[nodeIndex] = { ...node, position }
    changed = true
  }

  return changed ? nextNodes : currentNodes
}
