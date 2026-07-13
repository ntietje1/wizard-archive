import { createCanvasNodePlacement } from '../../nodes/canvas-node-modules'
import { getConstrainedRectFromPoints } from '../../utils/canvas-constraint-utils'
import {
  releasePointerCapture,
  screenEventToCanvasPosition,
  setPointerCapture,
} from './tool-module-utils'
import type { CanvasToolHandlers, CanvasToolRuntime } from '../canvas-tool-types'
import type { CanvasNodeType } from '../../document-contract'
const MIN_DRAG_RECT_SIZE = 10
type PlacementDragState =
  | { kind: 'idle' }
  | {
      kind: 'dragging'
      start: { x: number; y: number }
      captureTarget: Element | null
      pointerId: number
    }

export function createRectangularPlacementToolController<
  TNodeType extends Extract<CanvasNodeType, 'text'>,
>(nodeType: TNodeType, services: CanvasToolRuntime): CanvasToolHandlers {
  let dragState: PlacementDragState = { kind: 'idle' }
  let lastClientPos = { x: 0, y: 0 }
  let rafId = 0

  const updateDragRect = () => {
    if (dragState.kind !== 'dragging') {
      return
    }

    const pos = services.viewport.screenToCanvasPosition(lastClientPos)
    services.localOverlay.setRectCreationDragRect(
      getConstrainedRectFromPoints(dragState.start, pos, {
        square: services.modifiers.getShiftPressed(),
      }),
    )
  }

  const scheduleDragRectUpdate = () => {
    if (rafId) {
      return
    }

    rafId = requestAnimationFrame(() => {
      rafId = 0
      updateDragRect()
    })
  }

  const reset = () => {
    const previousDragState = dragState
    dragState = { kind: 'idle' }
    services.localOverlay.setRectCreationDragRect(null)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (previousDragState.kind === 'dragging') {
      releasePointerCapture(previousDragState.captureTarget, previousDragState.pointerId)
    }
  }

  const isActivePointer = (event: PointerEvent) =>
    dragState.kind === 'dragging' && event.pointerId === dragState.pointerId

  const createNodeAtPointer = (
    position: { x: number; y: number },
    point: { x: number; y: number },
  ) => {
    const placement = createCanvasNodePlacement(nodeType, { position })
    finalizePlacement(placement, point)
  }

  const finalizePlacement = (
    placement: ReturnType<typeof createCanvasNodePlacement<TNodeType>>,
    point: { x: number; y: number },
  ) => {
    services.commands.createNode(placement.node)
    if (placement.selectOnCreate) {
      services.selection.setSelection({ nodeIds: new Set([placement.node.id]), edgeIds: new Set() })
    }
    services.toolState.setActiveTool('select')
    if (placement.startEditing) {
      services.editSession.setPendingEdit({ nodeId: placement.node.id, point })
    }
  }

  const createNodeFromRect = (
    rect: { x: number; y: number; width: number; height: number },
    point: { x: number; y: number },
  ) => {
    const placement = createCanvasNodePlacement(nodeType, {
      position: {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      },
      size: { width: rect.width, height: rect.height },
    })
    finalizePlacement(placement, point)
  }

  return {
    onPointerDown: (event) => {
      if (dragState.kind === 'dragging' || event.button !== 0) {
        return
      }

      dragState = {
        kind: 'dragging',
        start: screenEventToCanvasPosition(services.viewport, event),
        captureTarget: setPointerCapture(event),
        pointerId: event.pointerId,
      }
      lastClientPos = { x: event.clientX, y: event.clientY }
      services.localOverlay.setRectCreationDragRect(null)
    },
    onPointerMove: (event) => {
      if (!isActivePointer(event) || (event.buttons & 1) !== 1) {
        return
      }

      lastClientPos = { x: event.clientX, y: event.clientY }
      scheduleDragRectUpdate()
    },
    onKeyDown: (event) => {
      if (event.key === 'Shift') {
        updateDragRect()
      }
    },
    onKeyUp: (event) => {
      if (event.key === 'Shift') {
        updateDragRect()
      }
    },
    onPointerUp: (event) => {
      if (dragState.kind !== 'dragging' || event.pointerId !== dragState.pointerId) {
        return
      }

      const { start } = dragState

      lastClientPos = { x: event.clientX, y: event.clientY }
      const point = { x: lastClientPos.x, y: lastClientPos.y }
      const pos = services.viewport.screenToCanvasPosition(lastClientPos)
      const rect = getConstrainedRectFromPoints(start, pos, {
        square: services.modifiers.getShiftPressed(),
      })

      try {
        if (rect.width >= MIN_DRAG_RECT_SIZE && rect.height >= MIN_DRAG_RECT_SIZE) {
          createNodeFromRect(rect, point)
        } else {
          createNodeAtPointer(start, point)
        }
      } finally {
        reset()
      }
    },
    onPointerCancel: (event) => {
      if (!isActivePointer(event)) {
        return
      }

      reset()
    },
  }
}
