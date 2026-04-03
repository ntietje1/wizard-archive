import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { SelectingState } from '../components/viewer/canvas/canvas-awareness-types'

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
      prevRect = userSelectionRect

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }

      if (!userSelectionRect) {
        useCanvasToolStore.getState().setSelectionRect(null)
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

        useCanvasToolStore.getState().setSelectionRect(flowRect)
        setLocalSelecting({ type: 'rect', ...flowRect })
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
