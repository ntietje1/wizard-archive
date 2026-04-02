import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { DrawingState } from '../components/viewer/canvas/canvas-awareness-types'
import type { StrokeData } from '../components/viewer/canvas/canvas-stroke-utils'
import type * as Y from 'yjs'

interface UseCanvasDrawingOptions {
  strokesMap: Y.Map<StrokeData>
  setAwarenessDrawing: (drawing: DrawingState | null) => void
}

export function useCanvasDrawing({
  strokesMap,
  setAwarenessDrawing,
}: UseCanvasDrawingOptions) {
  const pointsRef = useRef<Array<[number, number, number]>>([])
  const reactFlow = useReactFlow()

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      const { strokeColor, strokeSize, setLocalDrawing } =
        useCanvasToolStore.getState()
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5]
      pointsRef.current = [point]
      const drawing = { points: [point], color: strokeColor, size: strokeSize }
      setLocalDrawing(drawing)
      setAwarenessDrawing(drawing)
    },
    [reactFlow, setAwarenessDrawing],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1 || pointsRef.current.length === 0) return
      const { strokeColor, strokeSize, setLocalDrawing } =
        useCanvasToolStore.getState()
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
      }
      setLocalDrawing(drawing)
      setAwarenessDrawing(drawing)
    },
    [reactFlow, setAwarenessDrawing],
  )

  const onPointerUp = useCallback(() => {
    const { strokeColor, strokeSize, setLocalDrawing } =
      useCanvasToolStore.getState()
    const points = pointsRef.current
    if (points.length >= 2) {
      const id = crypto.randomUUID()
      const stroke: StrokeData = {
        id,
        points: [...points],
        color: strokeColor,
        size: strokeSize,
      }
      strokesMap.set(id, stroke)
    }
    pointsRef.current = []
    setLocalDrawing(null)
    setAwarenessDrawing(null)
  }, [strokesMap, setAwarenessDrawing])

  return { onPointerDown, onPointerMove, onPointerUp }
}
