import { useCallback, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import {
  pointInPolygon,
  strokePathIntersectsPolygon,
} from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'
import type { Point2D, SelectingState } from '../utils/canvas-awareness-types'

interface UseCanvasLassoSelectionOptions {
  setLocalSelecting: (selecting: SelectingState | null) => void
}

export function useCanvasLassoSelection({
  setLocalSelecting,
}: UseCanvasLassoSelectionOptions) {
  const pointsRef = useRef<Array<Point2D>>([])
  const activeRef = useRef(false)
  const capturedRef = useRef<{
    element: Element
    pointerId: number
  } | null>(null)
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      target.setPointerCapture(e.pointerId)
      capturedRef.current = { element: target, pointerId: e.pointerId }
      activeRef.current = true
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      pointsRef.current = [pos]
      useCanvasToolStore.getState().setLassoPath([pos])
      setLocalSelecting({ type: 'lasso', points: [pos] })
      reactFlow.setNodes((nodes) =>
        nodes.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
      )
      reactFlow.setEdges((edges) =>
        edges.map((edge) =>
          edge.selected ? { ...edge, selected: false } : edge,
        ),
      )
    },
    [reactFlow, setLocalSelecting],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current || e.buttons !== 1) return
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      pointsRef.current.push(pos)
      const path = [...pointsRef.current]
      useCanvasToolStore.getState().setLassoPath(path)
      setLocalSelecting({ type: 'lasso', points: path })
    },
    [reactFlow, setLocalSelecting],
  )

  const onPointerUp = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    if (capturedRef.current) {
      try {
        capturedRef.current.element.releasePointerCapture(
          capturedRef.current.pointerId,
        )
      } catch {
        /* already released */
      }
      capturedRef.current = null
    }
    setLocalSelecting(null)
    const polygon = pointsRef.current
    const store = useCanvasToolStore.getState()

    if (polygon.length < 3) {
      store.setLassoPath([])
      return
    }

    const { nodeLookup } = storeApi.getState()
    const selectedNodeIds = new Set<string>()

    // Strokes use intersection (any overlap selects) since they're thin paths;
    // non-stroke nodes use full containment (all corners inside lasso).
    nodeLookup.forEach((internalNode, nodeId) => {
      const { position, measured } = internalNode
      if (!measured?.width || !measured?.height) return

      if (internalNode.type === 'stroke') {
        const strokeData = internalNode.data as StrokeNodeData
        if (!strokeData?.bounds || !Array.isArray(strokeData.points)) return
        const offsetX = position.x - strokeData.bounds.x
        const offsetY = position.y - strokeData.bounds.y
        const adjustedPoints = strokeData.points.map(
          ([x, y, p]) =>
            [x + offsetX, y + offsetY, p] as [number, number, number],
        )
        if (strokePathIntersectsPolygon(adjustedPoints, polygon)) {
          selectedNodeIds.add(nodeId)
        }
        return
      }

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
      nodes.map((n) => {
        const isSelected = selectedNodeIds.has(n.id)
        return n.selected === isSelected ? n : { ...n, selected: isSelected }
      }),
    )

    reactFlow.setEdges((edges) =>
      edges.map((edge) => {
        const isSelected =
          selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
        return edge.selected === isSelected
          ? edge
          : { ...edge, selected: isSelected }
      }),
    )

    store.setLassoPath([])
    pointsRef.current = []
  }, [reactFlow, storeApi, setLocalSelecting])

  return { onPointerDown, onPointerMove, onPointerUp }
}
