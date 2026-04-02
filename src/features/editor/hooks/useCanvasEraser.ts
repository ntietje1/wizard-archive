import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { polylineIntersectsStroke } from '../components/viewer/canvas/canvas-stroke-utils'
import type { StrokeData } from '../components/viewer/canvas/canvas-stroke-utils'
import type * as Y from 'yjs'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

interface UseCanvasEraserOptions {
  strokesMap: Y.Map<StrokeData>
}

export function useCanvasEraser({ strokesMap }: UseCanvasEraserOptions) {
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const erasingRef = useRef(false)
  const markedRef = useRef(new Set<string>())
  const reactFlow = useReactFlow()

  const testIntersections = useCallback(() => {
    const trail = trailRef.current
    if (trail.length < 2) return

    const strokes = yMapToArray(strokesMap)
    let changed = false
    for (const stroke of strokes) {
      if (markedRef.current.has(stroke.id)) continue
      if (polylineIntersectsStroke(trail, stroke)) {
        markedRef.current.add(stroke.id)
        changed = true
      }
    }
    if (changed) {
      useCanvasToolStore
        .getState()
        .setErasingStrokeIds(new Set(markedRef.current))
    }
  }, [strokesMap])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      erasingRef.current = true
      markedRef.current = new Set()
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      trailRef.current = [pos]
      useCanvasToolStore.getState().setErasingStrokeIds(new Set())
    },
    [reactFlow],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!erasingRef.current || e.buttons !== 1) return
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      trailRef.current.push(pos)
      testIntersections()
    },
    [reactFlow, testIntersections],
  )

  const onPointerUp = useCallback(() => {
    erasingRef.current = false
    for (const id of markedRef.current) {
      strokesMap.delete(id)
    }
    markedRef.current = new Set()
    trailRef.current = []
    useCanvasToolStore.getState().setErasingStrokeIds(new Set())
  }, [strokesMap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
