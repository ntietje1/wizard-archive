import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { isStrokeNode, strokeNodeIntersectsRect } from '../utils/canvas-stroke-utils'
import type { ReactFlowInstance } from '@xyflow/react'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { SelectingState } from '../utils/canvas-awareness-types'
import type { StrokeNodeType } from '../components/nodes/stroke-node'

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
                if (!n.selected || !isStrokeNode(n)) return n
                if (!strokeNodeIntersectsRect(n, selRect)) {
                  return { ...n, selected: false }
                }
                return n
              }),
            )
          }
        }
        lastFlowRectRef.current = null
        const store = useCanvasInteractionStore.getState()
        store.setSelectionDragRect(null)
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
        store.setSelectionDragRect(flowRect)
        setLocalSelectingRef.current({ type: 'rect', ...flowRect })

        const deselected = new Set<string>()
        const selectedStrokes = reactFlow
          .getNodes()
          .filter((n): n is StrokeNodeType => !!n.selected && isStrokeNode(n))
        for (const n of selectedStrokes) {
          if (!strokeNodeIntersectsRect(n, flowRect)) {
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
      store.setSelectionDragRect(null)
      store.setRectDeselectedIds(new Set())
      setLocalSelectingRef.current(null)
    }
  }, [enabled, reactFlow, storeApi])
}
