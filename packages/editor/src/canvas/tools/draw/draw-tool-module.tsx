import { Pencil } from 'lucide-react'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToCanvasPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolSpec } from '../canvas-tool-types'
import { DrawAwarenessLayer } from './draw-tool-awareness-layer'
import { setDrawToolAwareness } from './draw-tool-awareness'
import { DrawToolLocalOverlayLayer } from './draw-tool-local-overlay-layer'
import { clampStrokeNodeSize, getStrokeBounds } from '../../nodes/stroke/stroke-node-model'
import { freehandStrokeSizeCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasStrokeSizeProperty } from '../../properties/canvas-property-types'
import { constrainPointToAxis } from '../../utils/canvas-constraint-utils'
import { bindCanvasToolLinePaintProperty } from '../shared/tool-paint-properties'

type ActiveDrawStrokeStyle = {
  color: string
  opacity: number
  size: number
}

type ActiveDrawStroke = ActiveDrawStrokeStyle & {
  points: Array<[number, number, number]>
}

export const drawToolSpec: CanvasToolSpec<'draw'> = {
  id: 'draw',
  label: 'Draw',
  group: 'creation',
  icon: <Pencil className="h-4 w-4" />,
  cursor: 'crosshair',
  properties: (context) => {
    return {
      bindings: [
        bindCanvasToolLinePaintProperty(context),
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
  },
  createHandlers: (services) => {
    let rawPoints: Array<[number, number, number]> = []
    let activeStrokeStyle: ActiveDrawStrokeStyle | null = null
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
      activeStrokeStyle = null
      services.localOverlay.setDrawLocalDrawing(null)
      setDrawToolAwareness(services.awareness.presence, null)
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    const isActivePointer = (event: PointerEvent) =>
      pointerId !== null && event.pointerId === pointerId
    const pointerPressure = (event: PointerEvent) => event.pressure ?? 0.5
    const createDrawing = (
      points: Array<[number, number, number]>,
      style: ActiveDrawStrokeStyle,
    ): ActiveDrawStroke => ({
      points,
      color: style.color,
      size: style.size,
      opacity: style.opacity,
    })

    return {
      onPointerDown: (event) => {
        if (pointerId !== null || event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        const { strokeColor, strokeOpacity, strokeSize } = services.toolState.getSettings()
        activeStrokeStyle = {
          color: strokeColor,
          opacity: strokeOpacity,
          size: clampStrokeNodeSize(strokeSize),
        }
        const pos = screenEventToCanvasPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, pointerPressure(event)]
        rawPoints = [point]

        const drawing = createDrawing([point], activeStrokeStyle)

        services.localOverlay.setDrawLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerMove: (event) => {
        if (
          !isActivePointer(event) ||
          (event.buttons & 1) !== 1 ||
          rawPoints.length === 0 ||
          !activeStrokeStyle
        ) {
          return
        }

        const pos = screenEventToCanvasPosition(services.viewport, event)
        const point: [number, number, number] = [pos.x, pos.y, pointerPressure(event)]
        rawPoints.push(point)
        const renderedPoints = getRenderedPoints()

        const drawing = createDrawing([...renderedPoints], activeStrokeStyle)

        services.localOverlay.setDrawLocalDrawing(drawing)
        setDrawToolAwareness(services.awareness.presence, drawing)
      },
      onPointerUp: (event) => {
        if (!isActivePointer(event)) return
        if (!activeStrokeStyle) {
          clearDrawing()
          return
        }

        const pos = screenEventToCanvasPosition(services.viewport, event)
        rawPoints.push([pos.x, pos.y, pointerPressure(event)])
        const renderedPoints = getRenderedPoints()
        if (renderedPoints.length >= 2) {
          const bounds = getStrokeBounds(renderedPoints, activeStrokeStyle.size)
          services.commands.createNode({
            id: crypto.randomUUID(),
            type: 'stroke',
            position: { x: bounds.x, y: bounds.y },
            width: bounds.width,
            height: bounds.height,
            data: {
              points: [...renderedPoints],
              color: activeStrokeStyle.color,
              size: activeStrokeStyle.size,
              opacity: activeStrokeStyle.opacity,
              bounds,
            },
          })
        }

        clearDrawing()
      },
      onPointerCancel: (event) => {
        if (!isActivePointer(event)) return
        clearDrawing()
      },
    }
  },
}
