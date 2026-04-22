import { createCanvasNodePlacement } from '../../nodes/canvas-node-modules'
import { getConstrainedRectFromPoints } from '../../utils/canvas-constraint-utils'
import {
  releasePointerCapture,
  screenEventToFlowPosition,
  setPointerCapture,
} from './tool-module-utils'
import { setRectCreationDragRect } from './rect-creation-local-overlay'
import type { CanvasToolController, CanvasToolServices } from '../canvas-tool-types'
import type { CanvasNodeType } from '../../nodes/canvas-node-module-types'

const MIN_DRAG_RECT_SIZE = 10

export function createRectangularPlacementToolController<
  TNodeType extends Extract<CanvasNodeType, 'text'>,
>(nodeType: TNodeType, services: CanvasToolServices): CanvasToolController {
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

    const pos = services.viewport.screenToFlowPosition(lastClientPos)
    setRectCreationDragRect(
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
    setRectCreationDragRect(null)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    releasePointerCapture(captureTarget, pointerId)
    captureTarget = null
    pointerId = null
  }

  const createNodeAtPointer = (
    position: { x: number; y: number },
    point: { x: number; y: number },
  ) => {
    const placement = createCanvasNodePlacement(nodeType, { position })
    services.commands.createNode(placement.node)
    if (placement.node.selected) {
      services.selection.replaceNodes([placement.node.id])
    }
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
    services.commands.createNode(placement.node)
    if (placement.node.selected) {
      services.selection.replaceNodes([placement.node.id])
    }
    if (placement.startEditing) {
      services.editSession.setPendingEditNodePoint(point)
      services.editSession.setPendingEditNodeId(placement.node.id)
    }
  }

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) {
        return
      }

      captureTarget = setPointerCapture(event)
      pointerId = event.pointerId
      active = true
      start = screenEventToFlowPosition(services.viewport, event)
      lastClientPos = { x: event.clientX, y: event.clientY }
      setRectCreationDragRect(null)
    },
    onPointerMove: (event) => {
      if (!active || (event.buttons & 1) !== 1 || !start) {
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
      if (!start) {
        reset()
        return
      }

      lastClientPos = { x: event.clientX, y: event.clientY }
      const point = { x: lastClientPos.x, y: lastClientPos.y }
      const pos = services.viewport.screenToFlowPosition(lastClientPos)
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
        services.toolState.setActiveTool('select')
      }
    },
    onPointerCancel: () => {
      reset()
    },
  }
}
