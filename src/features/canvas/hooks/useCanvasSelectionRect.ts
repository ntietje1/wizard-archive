import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { strokePathIntersectsRect } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { SelectingState } from '../utils/canvas-awareness-types'

interface UseCanvasSelectionRectOptions {
  setLocalSelecting: (selecting: SelectingState | null) => void
  enabled: boolean
}

export function useCanvasSelectionRect({
  setLocalSelecting,
  enabled,
}: UseCanvasSelectionRectOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const rafRef = useRef(0)
  const lastFlowRectRef = useRef<Bounds | null>(null)

  useEffect(() => {
    if (!enabled) return

    let prevRect: {
      x: number
      y: number
      width: number
      height: number
    } | null = null

    const unsubscribe = storeApi.subscribe(() => {
      const state = storeApi.getState()
      const { userSelectionRect } = state

      if (userSelectionRect === prevRect) return
      if (
        userSelectionRect &&
        prevRect &&
        userSelectionRect.x === prevRect.x &&
        userSelectionRect.y === prevRect.y &&
        userSelectionRect.width === prevRect.width &&
        userSelectionRect.height === prevRect.height
      ) {
        return
      }
      const wasActive = prevRect !== null
      prevRect = userSelectionRect

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }

      if (!userSelectionRect) {
        if (wasActive && lastFlowRectRef.current) {
          const selRect = lastFlowRectRef.current
          reactFlow.setNodes((nodes) =>
            nodes.map((n) => {
              if (!n.selected || n.type !== 'stroke') return n
              const strokeData = n.data as StrokeNodeData
              const offsetX = n.position.x - strokeData.bounds.x
              const offsetY = n.position.y - strokeData.bounds.y
              const adjustedPoints = strokeData.points.map(
                ([x, y, p]) =>
                  [x + offsetX, y + offsetY, p] as [number, number, number],
              )
              if (
                !strokePathIntersectsRect(
                  adjustedPoints,
                  strokeData.size,
                  selRect,
                )
              ) {
                return { ...n, selected: false }
              }
              return n
            }),
          )
        }
        lastFlowRectRef.current = null
        const store = useCanvasToolStore.getState()
        store.setSelectionRect(null)
        store.setRectDeselectedIds(new Set())
        setLocalSelecting(null)
        return
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const current = storeApi.getState()
        if (!current.userSelectionRect) return

        const bounds = current.domNode?.getBoundingClientRect()
        const offsetX = bounds?.left ?? 0
        const offsetY = bounds?.top ?? 0

        const topLeft = reactFlow.screenToFlowPosition({
          x: current.userSelectionRect.x + offsetX,
          y: current.userSelectionRect.y + offsetY,
        })
        const bottomRight = reactFlow.screenToFlowPosition({
          x:
            current.userSelectionRect.x +
            current.userSelectionRect.width +
            offsetX,
          y:
            current.userSelectionRect.y +
            current.userSelectionRect.height +
            offsetY,
        })

        const flowRect = {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        }

        lastFlowRectRef.current = flowRect
        useCanvasToolStore.getState().setSelectionRect(flowRect)
        setLocalSelecting({ type: 'rect', ...flowRect })

        const deselected = new Set<string>()
        for (const n of reactFlow.getNodes()) {
          if (!n.selected || n.type !== 'stroke') continue
          const strokeData = n.data as StrokeNodeData
          const ox = n.position.x - strokeData.bounds.x
          const oy = n.position.y - strokeData.bounds.y
          const adjustedPoints = strokeData.points.map(
            ([x, y, p]) => [x + ox, y + oy, p] as [number, number, number],
          )
          if (
            !strokePathIntersectsRect(adjustedPoints, strokeData.size, flowRect)
          ) {
            deselected.add(n.id)
          }
        }
        useCanvasToolStore.getState().setRectDeselectedIds(deselected)
      })
    })

    return () => {
      unsubscribe()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      useCanvasToolStore.getState().setSelectionRect(null)
    }
  }, [enabled, reactFlow, storeApi, setLocalSelecting])
}
