import { useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { getStrokeBounds } from '../utils/canvas-stroke-utils'
import type { DrawingState } from '../utils/canvas-awareness-types'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDrawingOptions {
  nodesMap: Y.Map<Node>
  setAwarenessDrawing: (drawing: DrawingState | null) => void
}

export function useCanvasDrawing({ nodesMap, setAwarenessDrawing }: UseCanvasDrawingOptions) {
  const pointsRef = useRef<Array<[number, number, number]>>([])
  const reactFlow = useReactFlow()

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const { strokeColor, strokeSize, strokeOpacity } = useCanvasToolStore.getState()
    const { setLocalDrawing } = useCanvasInteractionStore.getState()
    const pos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5]
    pointsRef.current = [point]
    const drawing = {
      points: [point],
      color: strokeColor,
      size: strokeSize,
      opacity: strokeOpacity,
    }
    setLocalDrawing(drawing)
    setAwarenessDrawing(drawing)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1 || pointsRef.current.length === 0) return
    const { strokeColor, strokeSize, strokeOpacity } = useCanvasToolStore.getState()
    const { setLocalDrawing } = useCanvasInteractionStore.getState()
    const pos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5]
    pointsRef.current.push(point)
    const drawing = {
      points: [...pointsRef.current],
      color: strokeColor,
      size: strokeSize,
      opacity: strokeOpacity,
    }
    setLocalDrawing(drawing)
    setAwarenessDrawing(drawing)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    const { strokeColor, strokeSize, strokeOpacity } = useCanvasToolStore.getState()
    const { setLocalDrawing } = useCanvasInteractionStore.getState()
    const points = pointsRef.current
    if (points.length >= 2) {
      const bounds = getStrokeBounds(points, strokeSize)
      const id = crypto.randomUUID()
      const node: Node = {
        id,
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
      nodesMap.set(id, node)
    }
    pointsRef.current = []
    setLocalDrawing(null)
    setAwarenessDrawing(null)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    const { setLocalDrawing } = useCanvasInteractionStore.getState()
    pointsRef.current = []
    setLocalDrawing(null)
    setAwarenessDrawing(null)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
