import { Pencil } from 'lucide-react'
import { getStrokeBounds } from '../utils/canvas-stroke-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'
import type { Node } from '@xyflow/react'

export const drawToolModule: CanvasToolModule = {
  id: 'draw',
  label: 'Draw',
  group: 'creation',
  icon: <Pencil className="h-4 w-4" />,
  cursor: 'crosshair',
  oneShot: false,
  showsStyleControls: true,
  create: (runtime) => {
    let points: Array<[number, number, number]> = []
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const clearDrawing = () => {
      points = []
      runtime.interaction.setLocalDrawing(null)
      runtime.awareness.broadcastLocalDrawing(null)
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        const { strokeColor, strokeOpacity, strokeSize } = runtime.getSettings()
        const pos = screenEventToFlowPosition(runtime, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        points = [point]

        const drawing = {
          points: [point],
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
        }

        runtime.interaction.setLocalDrawing(drawing)
        runtime.awareness.broadcastLocalDrawing(drawing)
      },
      onPointerMove: (event) => {
        if ((event.buttons & 1) !== 1 || points.length === 0) return

        const { strokeColor, strokeOpacity, strokeSize } = runtime.getSettings()
        const pos = screenEventToFlowPosition(runtime, event)
        const point: [number, number, number] = [pos.x, pos.y, event.pressure || 0.5]
        points.push(point)

        const drawing = {
          points,
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
        }

        runtime.interaction.setLocalDrawing(drawing)
        runtime.awareness.broadcastLocalDrawing(drawing)
      },
      onPointerUp: (event) => {
        if (event.pointerId !== pointerId) return

        const { strokeColor, strokeOpacity, strokeSize } = runtime.getSettings()
        if (points.length >= 2) {
          const bounds = getStrokeBounds(points, strokeSize)
          const node: Node = {
            id: crypto.randomUUID(),
            type: 'stroke',
            position: { x: bounds.x, y: bounds.y },
            width: bounds.width,
            height: bounds.height,
            data: {
              points: [...points],
              color: strokeColor,
              size: strokeSize,
              opacity: strokeOpacity,
              bounds,
            },
          }
          runtime.document.createNode(node)
        }

        clearDrawing()
      },
      onPointerCancel: () => {
        clearDrawing()
      },
    }
  },
}
