import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { strokePathIntersectsRect } from '../utils/canvas-stroke-utils'
import type { ReactFlowInstance } from '@xyflow/react'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { SelectingState } from '../utils/canvas-awareness-types'
import type { StrokeNodeData } from '../components/nodes/stroke-node'

function translateStrokePoints(
  points: Array<[number, number, number]>,
  offset: { x: number; y: number },
): Array<[number, number, number]> {
  return points.map(([x, y, p]) => [x + offset.x, y + offset.y, p] as [number, number, number])
}

function screenToFlowRect(
  screenRect: { x: number; y: number; width: number; height: number },
  domBounds: DOMRect,
  flow: ReactFlowInstance,
): Bounds {
  const topLeft = flow.screenToFlowPosition({
    x: screenRect.x + domBounds.left,
    y: screenRect.y + domBounds.top,
  })
  const bottomRight = flow.screenToFlowPosition({
    x: screenRect.x + screenRect.width + domBounds.left,
    y: screenRect.y + screenRect.height + domBounds.top,
  })
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
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
      const lastScreenRect = prevRect
      prevRect = userSelectionRect

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }

      if (!userSelectionRect) {
        if (wasActive && lastScreenRect) {
          const current = storeApi.getState()
          const selRect = current.domNode
            ? screenToFlowRect(lastScreenRect, current.domNode.getBoundingClientRect(), reactFlow)
            : lastFlowRectRef.current
          if (selRect) {
            reactFlow.setNodes((nodes) =>
              nodes.map((n) => {
                if (!n.selected || n.type !== 'stroke') return n
                const strokeData = n.data as StrokeNodeData
                const offset = {
                  x: n.position.x - strokeData.bounds.x,
                  y: n.position.y - strokeData.bounds.y,
                }
                const adjustedPoints = translateStrokePoints(strokeData.points, offset)
                if (!strokePathIntersectsRect(adjustedPoints, strokeData.size, selRect)) {
                  return { ...n, selected: false }
                }
                return n
              }),
            )
          }
        }
        lastFlowRectRef.current = null
        const store = useCanvasInteractionStore.getState()
        store.setSelectionRect(null)
        store.setRectDeselectedIds(new Set())
        setLocalSelectingRef.current(null)
        return
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const current = storeApi.getState()
        if (!current.userSelectionRect || !current.domNode) return

        const flowRect = screenToFlowRect(
          current.userSelectionRect,
          current.domNode.getBoundingClientRect(),
          reactFlow,
        )

        const store = useCanvasInteractionStore.getState()
        lastFlowRectRef.current = flowRect
        store.setSelectionRect(flowRect)
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
          const adjustedPoints = translateStrokePoints(strokeData.points, offset)
          if (!strokePathIntersectsRect(adjustedPoints, strokeData.size, flowRect)) {
            deselected.add(n.id)
          }
        }
        store.setRectDeselectedIds(deselected)
      })
    })

    return () => {
      unsubscribe()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      const store = useCanvasInteractionStore.getState()
      store.setSelectionRect(null)
      store.setRectDeselectedIds(new Set())
      setLocalSelectingRef.current(null)
    }
  }, [enabled, reactFlow, storeApi])
}
