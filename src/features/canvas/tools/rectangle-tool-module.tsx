import { RectangleHorizontal } from 'lucide-react'
import { createRectangleNode } from '../utils/canvas-node-factories'
import { rectFromPoints } from '../utils/canvas-stroke-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'

const MIN_RECT_SIZE = 10

export const rectangleToolModule: CanvasToolModule<'rectangle'> = {
  id: 'rectangle',
  label: 'Rectangle',
  group: 'creation',
  icon: <RectangleHorizontal className="h-4 w-4" />,
  cursor: 'crosshair',
  oneShot: true,
  showsStyleControls: true,
  create: (runtime) => {
    let start: { x: number; y: number } | null = null
    let lastClientPos = { x: 0, y: 0 }
    let active = false
    let rafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const reset = () => {
      active = false
      start = null
      runtime.setSelectionDragRect(null)
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        active = true
        start = screenEventToFlowPosition(runtime, event)
        lastClientPos = { x: event.clientX, y: event.clientY }
        runtime.setSelectionDragRect(null)
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1 || !start) return

        lastClientPos = { x: event.clientX, y: event.clientY }
        if (rafId) return

        rafId = requestAnimationFrame(() => {
          rafId = 0
          if (!start) return
          const pos = runtime.screenToFlowPosition(lastClientPos)
          runtime.setSelectionDragRect(rectFromPoints(start, pos))
        })
      },
      onPointerUp: () => {
        if (!start) {
          reset()
          return
        }

        const pos = runtime.screenToFlowPosition(lastClientPos)
        const rect = rectFromPoints(start, pos)
        const { strokeColor, strokeOpacity } = runtime.getSettings()

        try {
          if (rect.width >= MIN_RECT_SIZE && rect.height >= MIN_RECT_SIZE) {
            runtime.createNode(
              createRectangleNode(rect, {
                color: strokeColor,
                opacity: strokeOpacity,
              }),
            )
          }
        } finally {
          reset()
          runtime.completeActiveToolAction()
        }
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
