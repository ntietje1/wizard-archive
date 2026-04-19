import { useEffect, useRef } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getMeasuredCanvasNodesFromLookup } from './canvas-measured-nodes'
import { useCanvasSelectionState } from './useCanvasSelectionState'
import { getCanvasNodesMatchingRectangle } from '../nodes/canvas-node-registry'
import { setSelectToolAwareness } from '../tools/select/select-tool-awareness'
import {
  setSelectToolRectDeselectedIds,
  setSelectToolSelectionDragRect,
} from '../tools/select/select-tool-local-overlay'
import type { CanvasAwarenessPresenceWriter } from '../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'
import type { Bounds } from '../utils/canvas-geometry-utils'

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
  awareness: CanvasAwarenessPresenceWriter
  setNodeSelection: (nodeIds: Array<string>) => void
  enabled: boolean
}

export function useCanvasSelectionRect({
  awareness,
  setNodeSelection,
  enabled,
}: UseCanvasSelectionRectOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const rafRef = useRef(0)
  const lastFlowRectRef = useRef<Bounds | null>(null)
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness

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
            const selectedNodeIds = getCanvasNodesMatchingRectangle(
              getMeasuredCanvasNodesFromLookup(current.nodeLookup),
              selRect,
              { zoom: reactFlow.getZoom() },
            )
            setNodeSelection(selectedNodeIds)
          }
        }
        lastFlowRectRef.current = null
        setSelectToolSelectionDragRect(null)
        setSelectToolRectDeselectedIds(new Set())
        useCanvasSelectionState.getState().setSelectionPhase('idle')
        setSelectToolAwareness(awarenessRef.current, null)
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

        lastFlowRectRef.current = flowRect
        setSelectToolSelectionDragRect(flowRect)
        useCanvasSelectionState.getState().setSelectionPhase('marquee')
        setSelectToolAwareness(awarenessRef.current, flowRect)

        const deselected = new Set<string>()
        const selectedNodeIds = new Set(useCanvasSelectionState.getState().selectedNodeIds)
        const selectedNodes = getMeasuredCanvasNodesFromLookup(current.nodeLookup).filter((node) =>
          selectedNodeIds.has(node.id),
        )
        const matchingIds = new Set(
          getCanvasNodesMatchingRectangle(selectedNodes, flowRect, { zoom: reactFlow.getZoom() }),
        )
        for (const n of selectedNodes) {
          if (!matchingIds.has(n.id)) {
            deselected.add(n.id)
          }
        }
        setSelectToolRectDeselectedIds(deselected)
      })
    })

    return () => {
      unsubscribe()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      setSelectToolSelectionDragRect(null)
      setSelectToolRectDeselectedIds(new Set())
      useCanvasSelectionState.getState().setSelectionPhase('idle')
      setSelectToolAwareness(awarenessRef.current, null)
    }
  }, [enabled, reactFlow, setNodeSelection, storeApi])
}
