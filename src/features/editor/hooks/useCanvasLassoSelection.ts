import { useCallback, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import {
  pointInPolygon,
  strokeInsidePolygon,
} from '../components/viewer/canvas/canvas-stroke-utils'
import type { StrokeData } from '../components/viewer/canvas/canvas-stroke-utils'
import type * as Y from 'yjs'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

interface UseCanvasLassoSelectionOptions {
  strokesMap: Y.Map<StrokeData>
}

export function useCanvasLassoSelection({
  strokesMap,
}: UseCanvasLassoSelectionOptions) {
  const pointsRef = useRef<Array<{ x: number; y: number }>>([])
  const activeRef = useRef(false)
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      activeRef.current = true
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      pointsRef.current = [pos]
      const store = useCanvasToolStore.getState()
      store.setLassoPath([pos])
      store.setSelectedStrokeIds(new Set())
      reactFlow.setNodes((nodes) =>
        nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      )
    },
    [reactFlow],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current || e.buttons !== 1) return
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      pointsRef.current.push(pos)
      useCanvasToolStore.getState().setLassoPath([...pointsRef.current])
    },
    [reactFlow],
  )

  const onPointerUp = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    const polygon = pointsRef.current
    const store = useCanvasToolStore.getState()

    if (polygon.length < 3) {
      store.setLassoPath([])
      return
    }

    const { nodeLookup } = storeApi.getState()
    const selectedNodeIds = new Set<string>()

    nodeLookup.forEach((internalNode, nodeId) => {
      const { position, measured } = internalNode
      if (!measured?.width || !measured?.height) return
      const corners = [
        { x: position.x, y: position.y },
        { x: position.x + measured.width, y: position.y },
        { x: position.x + measured.width, y: position.y + measured.height },
        { x: position.x, y: position.y + measured.height },
      ]
      if (corners.every((c) => pointInPolygon(c.x, c.y, polygon))) {
        selectedNodeIds.add(nodeId)
      }
    })

    reactFlow.setNodes((nodes) =>
      nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })),
    )

    const strokes = yMapToArray(strokesMap)
    const matchedStrokes = new Set<string>()
    for (const stroke of strokes) {
      if (strokeInsidePolygon(stroke, polygon)) {
        matchedStrokes.add(stroke.id)
      }
    }
    store.setSelectedStrokeIds(matchedStrokes)

    store.setLassoPath([])
    pointsRef.current = []
  }, [reactFlow, storeApi, strokesMap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
