import { Pencil } from 'lucide-react'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
import { DrawAwarenessLayer } from './draw-tool-awareness-layer'
import { setDrawToolAwareness } from './draw-tool-awareness'
import { clearDrawToolLocalOverlay, setDrawToolLocalDrawing } from './draw-tool-local-overlay'
import { DrawToolLocalOverlayLayer } from './draw-tool-local-overlay-layer'
import { getStrokeBounds } from '../../nodes/stroke/stroke-node-model'
import {
  paintCanvasProperty,
  strokeSizeCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import { constrainPointToAxis } from '../../utils/canvas-constraint-utils'

export const drawToolModule: CanvasToolModule<'draw'> = {
  id: 'draw',
  label: 'Draw',
  group: 'creation',
  icon: <Pencil className="h-4 w-4" />,
  cursor: 'crosshair',
  properties: (context) => {
    return {
      bindings: [
        bindCanvasPaintProperty(paintCanvasProperty, {
          getColor: () => context.toolState.getSettings().strokeColor,
          setColor: context.toolState.setStrokeColor,
          getOpacity: () => context.toolState.getSettings().strokeOpacity,
          setOpacity: context.toolState.setStrokeOpacity,
        }),
        bindCanvasStrokeSizeProperty(
          strokeSizeCanvasProperty,
          () => context.toolState.getSettings().strokeSize,
          context.toolState.setStrokeSize,
        ),
      ],
    }
  },
  awareness: {
    Layer: DrawAwarenessLayer,
  },
  localOverlay: {
    Layer: DrawToolLocalOverlayLayer,
    clear: clearDrawToolLocalOverlay,
  },
  create: (services) => {
    let rawPoints: Array<[number, number, number]> = []
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const getRenderedPoints = () => {
      if (rawPoints.length === 0) {
        return []
      }

      if (!services.modifiers.getShiftPressed() || rawPoints.length < 2) {
        return rawPoints
      }

      const [startX, startY, startPressure] = rawPoints[0]
      const [endX, endY, endPressure] = rawPoints[rawPoints.length - 1]
      const constrainedEnd = constrainPointToAxis({ x: startX, y: startY }, { x: endX, y: endY })

      return [
        [startX, startY, startPressure],
        [constrainedEnd.x, constrainedEnd.y, endPressure],
      ] satisfies Array<[number, number, number]>
    }

    const clearDrawing = () => {
      rawPoints = []
      setDrawToolLocalDrawing(null)
      setDrawToolAwareness(services.awareness.presence, null)
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        const pos = screenEventToFlowPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        rawPoints = [point]

        const drawing = {
          points: [point],
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
        }

        setDrawToolLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerMove: (event) => {
        if ((event.buttons & 1) !== 1 || rawPoints.length === 0) return

        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        const pos = screenEventToFlowPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        rawPoints.push(point)
        const renderedPoints = getRenderedPoints()

        const drawing = {
          points: [...renderedPoints],
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
        }

        setDrawToolLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerUp: (event) => {
        if (event.pointerId !== pointerId) return

        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        const renderedPoints = getRenderedPoints()
        if (renderedPoints.length >= 2) {
          const bounds = getStrokeBounds(renderedPoints, strokeSize)
          services.document.createNode({
            id: crypto.randomUUID(),
            type: 'stroke',
            position: { x: bounds.x, y: bounds.y },
            width: bounds.width,
            height: bounds.height,
            data: {
              points: [...renderedPoints],
              color: strokeColor,
              size: strokeSize,
              opacity: strokeOpacity,
              bounds,
            },
          })
        }

        clearDrawing()
      },
      onPointerCancel: () => {
        clearDrawing()
      },
    }
  },
}
