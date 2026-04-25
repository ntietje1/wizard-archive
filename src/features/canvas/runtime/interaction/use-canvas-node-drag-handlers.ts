import { useEffect, useRef } from 'react'
import { clearCanvasDragSnapGuides } from './canvas-drag-snap-overlay'
import { createCanvasDragController } from '../../system/canvas-drag-controller'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import { logger } from '~/shared/utils/logger'
import type { CanvasDragController, CanvasDragEvent } from '../../system/canvas-drag-controller'
import type { RefObject } from 'react'
import type { CanvasEngine } from '../../system/canvas-engine'
import type {
  CanvasCoreAwarenessWriter,
  CanvasDocumentWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type * as Y from 'yjs'

interface UseCanvasNodeDragHandlersOptions {
  canvasEngine: CanvasEngine
  documentWriter: CanvasDocumentWriter
  nodesDoc: Y.Doc | null | undefined
  remoteDragAnimation: CanvasRemoteDragAnimation
  awareness: CanvasCoreAwarenessWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  getFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }
  getZoom: () => number
  selection: CanvasSelectionController
  localDraggingIdsRef: RefObject<Set<string>>
  getShiftPressed: () => boolean
  getPrimaryPressed: () => boolean
  getCanStartDrag?: () => boolean
}

export function useCanvasNodeDragHandlers({
  canvasEngine,
  documentWriter,
  nodesDoc,
  remoteDragAnimation,
  awareness,
  interaction,
  getFlowPosition,
  getZoom,
  selection,
  localDraggingIdsRef,
  getShiftPressed,
  getPrimaryPressed,
  getCanStartDrag = () => true,
}: UseCanvasNodeDragHandlersOptions): CanvasDragController {
  const optionsRef = useRef({
    awareness,
    canvasEngine,
    documentWriter,
    getPrimaryPressed,
    getCanStartDrag,
    getShiftPressed,
    interaction,
    localDraggingIdsRef,
    nodesDoc,
    getFlowPosition,
    getZoom,
    remoteDragAnimation,
    selection,
  })
  optionsRef.current = {
    awareness,
    canvasEngine,
    documentWriter,
    getPrimaryPressed,
    getCanStartDrag,
    getShiftPressed,
    interaction,
    localDraggingIdsRef,
    nodesDoc,
    getFlowPosition,
    getZoom,
    remoteDragAnimation,
    selection,
  }

  const controllerRef = useRef<CanvasDragController | null>(null)
  controllerRef.current ??= createCanvasDragController({
    canvasEngine,
    getFlowPosition: (point) => optionsRef.current.getFlowPosition(point),
    getZoom: () => optionsRef.current.getZoom(),
    getSelectedNodeIds: () => optionsRef.current.selection.getSnapshot().nodeIds,
    getShiftPressed: () => optionsRef.current.getShiftPressed(),
    getPrimaryPressed: () => optionsRef.current.getPrimaryPressed(),
    getCanStartDrag: () => optionsRef.current.getCanStartDrag(),
    callbacks: {
      onStart: (event) =>
        measureCanvasPerformance(
          'canvas.drag.start',
          {
            draggedCount: event.draggedNodeIds.size,
            totalCount: optionsRef.current.canvasEngine.getSnapshot().nodes.length,
          },
          () => handleDragStart(event, optionsRef.current),
        ),
      onDrag: (event) =>
        measureCanvasPerformance(
          'canvas.drag.move',
          { draggedCount: event.draggedNodeIds.size },
          () => handleDrag(event, optionsRef.current),
        ),
      onEnd: (event) =>
        measureCanvasPerformance(
          'canvas.drag.stop',
          { draggedCount: event.draggedNodeIds.size },
          () => handleDragEnd(event, optionsRef.current),
        ),
    },
  })

  useEffect(
    () => () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
    },
    [],
  )

  return controllerRef.current
}

function handleDragStart(
  event: CanvasDragEvent,
  {
    localDraggingIdsRef,
    selection,
  }: Pick<UseCanvasNodeDragHandlersOptions, 'localDraggingIdsRef' | 'selection'>,
) {
  const localDraggingIds = localDraggingIdsRef.current
  if (!localDraggingIds) {
    return
  }

  for (const nodeId of event.draggedNodeIds) {
    localDraggingIds.add(nodeId)
  }

  if (!selection.getSnapshot().nodeIds.has(event.activeNodeId)) {
    selection.setSelection({ nodeIds: new Set([event.activeNodeId]), edgeIds: new Set() })
  }

  clearCanvasDragSnapGuides()
}

function handleDrag(
  event: CanvasDragEvent,
  {
    awareness,
    getFlowPosition,
  }: Pick<UseCanvasNodeDragHandlersOptions, 'awareness' | 'getFlowPosition'>,
) {
  awareness.setLocalDragging(Object.fromEntries(event.resolvedPositions))
  awareness.setLocalCursor(
    getFlowPosition({
      x: event.sourceEvent.clientX,
      y: event.sourceEvent.clientY,
    }),
  )
}

function handleDragEnd(
  event: CanvasDragEvent,
  {
    awareness,
    documentWriter,
    localDraggingIdsRef,
    nodesDoc,
    remoteDragAnimation,
    interaction,
  }: Pick<
    UseCanvasNodeDragHandlersOptions,
    | 'awareness'
    | 'documentWriter'
    | 'interaction'
    | 'localDraggingIdsRef'
    | 'nodesDoc'
    | 'remoteDragAnimation'
  >,
) {
  try {
    if (Math.hypot(event.delta.x, event.delta.y) > 0) {
      interaction.suppressNextSurfaceClick()
    }

    if (!nodesDoc) {
      logger.warn(
        'useCanvasNodeDragHandlers: missing Yjs doc during node drag stop; positions were not persisted',
      )
      return
    }

    documentWriter.setNodePositions(new Map(event.resolvedPositions))
  } catch (error) {
    logger.error('useCanvasNodeDragHandlers: failed to persist node drag positions', error)
  } finally {
    const localDraggingIds = localDraggingIdsRef.current
    if (localDraggingIds) {
      for (const nodeId of event.draggedNodeIds) {
        localDraggingIds.delete(nodeId)
      }
    }
    remoteDragAnimation.clearNodeSprings(event.draggedNodeIds)
    clearCanvasDragSnapGuides()
    awareness.setLocalDragging(null)
  }
}
