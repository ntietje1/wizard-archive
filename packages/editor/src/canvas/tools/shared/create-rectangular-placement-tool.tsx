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

export function createRectangularPlacementToolController<
  TNodeType extends Extract<CanvasNodeType, 'text'>,
>(nodeType: TNodeType, services: CanvasToolRuntime): CanvasToolHandlers {
  let start: { x: number; y: number } | null = null
  let lastClientPos = { x: 0, y: 0 }
  let active = false
  let rafId = 0
  let captureTarget: Element | null = null
  let pointerId: number | null = null

  const updateDragRect = () => {
    if (!active || !start) {
      return
    }

    const pos = services.viewport.screenToCanvasPosition(lastClientPos)
    services.localOverlay.setRectCreationDragRect(
      getConstrainedRectFromPoints(start, pos, {
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
    active = false
    start = null
    services.localOverlay.setRectCreationDragRect(null)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    releasePointerCapture(captureTarget, pointerId)
    captureTarget = null
    pointerId = null
  }

  const isActivePointer = (event: PointerEvent) => active && event.pointerId === pointerId

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
      services.editSession.setPendingEditNodePoint(point)
      services.editSession.setPendingEditNodeId(placement.node.id)
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
      if (active || event.button !== 0) {
        return
      }

      captureTarget = setPointerCapture(event)
      pointerId = event.pointerId
      active = true
      start = screenEventToCanvasPosition(services.viewport, event)
      lastClientPos = { x: event.clientX, y: event.clientY }
      services.localOverlay.setRectCreationDragRect(null)
    },
    onPointerMove: (event) => {
      if (!isActivePointer(event) || (event.buttons & 1) !== 1 || !start) {
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
      if (!isActivePointer(event)) {
        return
      }

      if (!start) {
        reset()
        return
      }

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
