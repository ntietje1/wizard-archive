import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { strokePathIntersectsRect } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { SelectingState } from '../utils/canvas-awareness-types'

function translateStrokePoints(
  points: Array<[number, number, number]>,
  offset: { x: number; y: number },
): Array<[number, number, number]> {
  return points.map(
    ([x, y, p]) => [x + offset.x, y + offset.y, p] as [number, number, number],
  )
}

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
  const setLocalSelectingRef = useRef(setLocalSelecting)
  setLocalSelectingRef.current = setLocalSelecting

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
              const offset = {
                x: n.position.x - strokeData.bounds.x,
                y: n.position.y - strokeData.bounds.y,
              }
              const adjustedPoints = translateStrokePoints(
                strokeData.points,
                offset,
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
        setLocalSelectingRef.current(null)
        return
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const current = storeApi.getState()
        if (!current.userSelectionRect || !current.domNode) return

        const bounds = current.domNode.getBoundingClientRect()

        const topLeft = reactFlow.screenToFlowPosition({
          x: current.userSelectionRect.x + bounds.left,
          y: current.userSelectionRect.y + bounds.top,
        })
        const bottomRight = reactFlow.screenToFlowPosition({
          x:
            current.userSelectionRect.x +
            current.userSelectionRect.width +
            bounds.left,
          y:
            current.userSelectionRect.y +
            current.userSelectionRect.height +
            bounds.top,
        })

        const flowRect = {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        }

        lastFlowRectRef.current = flowRect
        useCanvasToolStore.getState().setSelectionRect(flowRect)
        setLocalSelectingRef.current({ type: 'rect', ...flowRect })

        const deselected = new Set<string>()
        const selectedStrokes = reactFlow
          .getNodes()
          .filter((n) => n.selected && n.type === 'stroke')
        for (const n of selectedStrokes) {
          const strokeData = n.data as StrokeNodeData
          const offset = {
            x: n.position.x - strokeData.bounds.x,
            y: n.position.y - strokeData.bounds.y,
          }
          const adjustedPoints = translateStrokePoints(
            strokeData.points,
            offset,
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
  }, [enabled, reactFlow, storeApi])
}
