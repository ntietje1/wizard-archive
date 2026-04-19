import { RectangleHorizontal } from 'lucide-react'
import { createCanvasNode } from '../../nodes/canvas-node-registry'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
import { rectFromPoints } from '../../utils/canvas-geometry-utils'
import { paintCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'
import {
  clearRectangleToolLocalOverlay,
  setRectangleToolDragRect,
} from './rectangle-tool-local-overlay'
import { RectangleToolLocalOverlayLayer } from './rectangle-tool-local-overlay-layer'

const MIN_RECT_SIZE = 10

export const rectangleToolModule: CanvasToolModule<'rectangle'> = {
  id: 'rectangle',
  label: 'Rectangle',
  group: 'creation',
  icon: <RectangleHorizontal className="h-4 w-4" />,
  cursor: 'crosshair',
  localOverlay: {
    Layer: RectangleToolLocalOverlayLayer,
    clear: clearRectangleToolLocalOverlay,
  },
  properties: (context) => {
    return {
      bindings: [
        bindCanvasPaintProperty(paintCanvasProperty, {
          getColor: () => context.toolState.getSettings().strokeColor,
          setColor: context.toolState.setStrokeColor,
          getOpacity: () => context.toolState.getSettings().strokeOpacity,
          setOpacity: context.toolState.setStrokeOpacity,
        }),
      ],
    }
  },
  create: (environment) => {
    let start: { x: number; y: number } | null = null
    let lastClientPos = { x: 0, y: 0 }
    let active = false
    let rafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const reset = () => {
      active = false
      start = null
      setRectangleToolDragRect(null)
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
        start = screenEventToFlowPosition(environment.viewport, event)
        lastClientPos = { x: event.clientX, y: event.clientY }
        setRectangleToolDragRect(null)
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1 || !start) return

        lastClientPos = { x: event.clientX, y: event.clientY }
        if (rafId) return

        rafId = requestAnimationFrame(() => {
          rafId = 0
          if (!start) return
          const pos = environment.viewport.screenToFlowPosition(lastClientPos)
          setRectangleToolDragRect(rectFromPoints(start, pos))
        })
      },
      onPointerUp: () => {
        if (!start) {
          reset()
          return
        }

        const pos = environment.viewport.screenToFlowPosition(lastClientPos)
        const rect = rectFromPoints(start, pos)
        const { strokeColor, strokeOpacity } = environment.toolState.getSettings()

        try {
          if (rect.width >= MIN_RECT_SIZE && rect.height >= MIN_RECT_SIZE) {
            const node = createCanvasNode('rectangle', {
              position: { x: rect.x, y: rect.y },
              size: { width: rect.width, height: rect.height },
              data: {
                color: strokeColor,
                opacity: strokeOpacity,
              },
            })
            environment.document.createNode(node)
            if (node.selected) {
              environment.selection.replace([node.id])
            }
          }
        } finally {
          reset()
          environment.toolState.setActiveTool('select')
        }
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
