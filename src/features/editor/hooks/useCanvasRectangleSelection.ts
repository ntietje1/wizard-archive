import { useCallback, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import {
  rectIntersectsBounds,
  strokeInsideRect,
} from '../components/viewer/canvas/canvas-stroke-utils'
import type {
  Bounds,
  StrokeData,
} from '../components/viewer/canvas/canvas-stroke-utils'
import type * as Y from 'yjs'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

function toBounds(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Bounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

interface UseCanvasRectangleSelectionOptions {
  strokesMap: Y.Map<StrokeData>
}

export function useCanvasRectangleSelection({
  strokesMap,
}: UseCanvasRectangleSelectionOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const rectRef = useRef<Bounds | null>(null)
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
      startRef.current = pos
      rectRef.current = null
      const store = useCanvasToolStore.getState()
      store.setSelectionRect(null)
      store.setSelectedStrokeIds(new Set())
      reactFlow.setNodes((nodes) =>
        nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      )
    },
    [reactFlow],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current || e.buttons !== 1 || !startRef.current) return
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      const rect = toBounds(startRef.current, pos)
      rectRef.current = rect
      useCanvasToolStore.getState().setSelectionRect(rect)
    },
    [reactFlow],
  )

  const onPointerUp = useCallback(() => {
    if (!activeRef.current || !startRef.current) return
    activeRef.current = false

    const rect = rectRef.current
    const store = useCanvasToolStore.getState()

    if (!rect || rect.width < 5 || rect.height < 5) {
      store.setSelectionRect(null)
      startRef.current = null
      rectRef.current = null
      return
    }

    const { nodeLookup } = storeApi.getState()
    const selectedNodeIds = new Set<string>()

    nodeLookup.forEach((internalNode, nodeId) => {
      const { position, measured } = internalNode
      if (!measured?.width || !measured?.height) return
      const nodeBounds: Bounds = {
        x: position.x,
        y: position.y,
        width: measured.width,
        height: measured.height,
      }
      if (rectIntersectsBounds(rect, nodeBounds)) {
        selectedNodeIds.add(nodeId)
      }
    })

    reactFlow.setNodes((nodes) =>
      nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })),
    )

    const strokes = yMapToArray(strokesMap)
    const matchedStrokes = new Set<string>()
    for (const stroke of strokes) {
      if (strokeInsideRect(stroke, rect)) {
        matchedStrokes.add(stroke.id)
      }
    }
    store.setSelectedStrokeIds(matchedStrokes)

    store.setSelectionRect(null)
    startRef.current = null
    rectRef.current = null
  }, [reactFlow, storeApi, strokesMap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
