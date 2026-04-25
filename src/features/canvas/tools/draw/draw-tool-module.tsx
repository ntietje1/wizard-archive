import { Pencil } from 'lucide-react'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToCanvasPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolSpec } from '../canvas-tool-types'
import { DrawAwarenessLayer } from './draw-tool-awareness-layer'
import { setDrawToolAwareness } from './draw-tool-awareness'
import { clearDrawToolLocalOverlay, setDrawToolLocalDrawing } from './draw-tool-local-overlay'
import { DrawToolLocalOverlayLayer } from './draw-tool-local-overlay-layer'
import { clampStrokeNodeSize, getStrokeBounds } from '../../nodes/stroke/stroke-node-model'
import {
  freehandStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import { constrainPointToAxis } from '../../utils/canvas-constraint-utils'

export const drawToolSpec: CanvasToolSpec<'draw'> = {
  id: 'draw',
  label: 'Draw',
  group: 'creation',
  icon: <Pencil className="h-4 w-4" />,
  cursor: 'crosshair',
  properties: (context) => {
    return {
      bindings: [
        bindCanvasPaintProperty(linePaintCanvasProperty, {
          getColor: () => context.toolState.getSettings().strokeColor,
          setColor: context.toolState.setStrokeColor,
          getOpacity: () => context.toolState.getSettings().strokeOpacity,
          setOpacity: context.toolState.setStrokeOpacity,
        }),
        bindCanvasStrokeSizeProperty(
          freehandStrokeSizeCanvasProperty,
          () => clampStrokeNodeSize(context.toolState.getSettings().strokeSize),
          (size) => context.toolState.setStrokeSize(clampStrokeNodeSize(size)),
        ),
      ],
    }
  },
  awareness: {
    Layer: DrawAwarenessLayer,
    clear: (presence) => setDrawToolAwareness(presence, null),
  },
  localOverlay: {
    Layer: DrawToolLocalOverlayLayer,
    clear: clearDrawToolLocalOverlay,
  },
  createHandlers: (services) => {
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
        const normalizedStrokeSize = clampStrokeNodeSize(strokeSize)
        const pos = screenEventToCanvasPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        rawPoints = [point]

        const drawing = {
          points: [point],
          color: strokeColor,
          size: normalizedStrokeSize,
          opacity: strokeOpacity,
        }

        setDrawToolLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerMove: (event) => {
        if ((event.buttons & 1) !== 1 || rawPoints.length === 0) return

        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        const normalizedStrokeSize = clampStrokeNodeSize(strokeSize)
        const pos = screenEventToCanvasPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        rawPoints.push(point)
        const renderedPoints = getRenderedPoints()

        const drawing = {
          points: [...renderedPoints],
          color: strokeColor,
          size: normalizedStrokeSize,
          opacity: strokeOpacity,
        }

        setDrawToolLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerUp: (event) => {
        if (event.pointerId !== pointerId) return

        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        const normalizedStrokeSize = clampStrokeNodeSize(strokeSize)
        const renderedPoints = getRenderedPoints()
        if (renderedPoints.length >= 2) {
          const bounds = getStrokeBounds(renderedPoints, normalizedStrokeSize)
          services.commands.createNode({
            id: crypto.randomUUID(),
            type: 'stroke',
            position: { x: bounds.x, y: bounds.y },
            width: bounds.width,
            height: bounds.height,
            data: {
              points: [...renderedPoints],
              color: strokeColor,
              size: normalizedStrokeSize,
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
