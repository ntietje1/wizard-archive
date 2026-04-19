import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import { getCanvasNodesMatchingRectangle } from '../../nodes/canvas-node-registry'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from './use-canvas-pending-selection-preview'
import { setSelectToolAwareness } from '../../tools/select/select-tool-awareness'
import { setSelectToolSelectionDragRect } from '../../tools/select/select-tool-local-overlay'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'
import type { Bounds } from '../../utils/canvas-geometry-utils'

const MIN_SELECTION_DRAG_DISTANCE_PX = 1

function clientRectToFlowRect(
  clientRect: { left: number; top: number; right: number; bottom: number },
  flow: ReactFlowInstance,
): Bounds {
  const topLeft = flow.screenToFlowPosition({ x: clientRect.left, y: clientRect.top })
  const bottomRight = flow.screenToFlowPosition({ x: clientRect.right, y: clientRect.bottom })
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
}

function boundsEqual(a: Bounds | null, b: Bounds | null): boolean {
  return a?.x === b?.x && a?.y === b?.y && a?.width === b?.width && a?.height === b?.height
}

interface UseCanvasSelectionRectOptions {
  surfaceRef: RefObject<HTMLDivElement | null>
  awareness: CanvasAwarenessPresenceWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  selection: Pick<
    CanvasSelectionController,
    'beginGesture' | 'commitGestureSelection' | 'endGesture'
  >
  enabled: boolean
}

export function useCanvasSelectionRect({
  surfaceRef,
  awareness,
  interaction,
  selection,
  enabled,
}: UseCanvasSelectionRectOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const lastFlowRectRef = useRef<Bounds | null>(null)
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    if (!enabled) return
    const pane = surfaceRef.current?.querySelector<HTMLDivElement>('.react-flow__pane')
    if (!pane) return

    let selectionStartClientPoint: { x: number; y: number } | null = null
    let latestClientPoint: { x: number; y: number } | null = null
    let selectionActive = false
    let previewRafId = 0
    let lastPublishedRect: Bounds | null = null

    function publishSelectToolAwareness(rect: Bounds | null) {
      if (boundsEqual(lastPublishedRect, rect)) return
      lastPublishedRect = rect
      setSelectToolAwareness(awarenessRef.current, rect)
    }

    function cancelSelectionPreviewFrame() {
      if (!previewRafId) return
      cancelAnimationFrame(previewRafId)
      previewRafId = 0
    }

    function clearLocalSelectionGesture() {
      cancelSelectionPreviewFrame()
      lastFlowRectRef.current = null
      latestClientPoint = null
      setSelectToolSelectionDragRect(null)
      clearCanvasPendingSelectionPreview()
      selectionRef.current.endGesture()
      publishSelectToolAwareness(null)
    }

    function updateSelectionRect(currentClientPoint: { x: number; y: number }) {
      if (!selectionStartClientPoint) return

      const flowRect = clientRectToFlowRect(
        {
          left: Math.min(selectionStartClientPoint.x, currentClientPoint.x),
          top: Math.min(selectionStartClientPoint.y, currentClientPoint.y),
          right: Math.max(selectionStartClientPoint.x, currentClientPoint.x),
          bottom: Math.max(selectionStartClientPoint.y, currentClientPoint.y),
        },
        reactFlow,
      )

      lastFlowRectRef.current = flowRect
      setSelectToolSelectionDragRect(flowRect)
      if (!selectionActive) {
        selectionActive = true
        selectionRef.current.beginGesture('marquee')
      }
      publishSelectToolAwareness(flowRect)
      const current = storeApi.getState()
      const pendingNodeIds = getCanvasNodesMatchingRectangle(
        getMeasuredCanvasNodesFromLookup(current.nodeLookup),
        flowRect,
        { zoom: reactFlow.getZoom() },
      )
      setCanvasPendingSelectionPreview(pendingNodeIds)
    }

    function scheduleSelectionPreviewUpdate() {
      if (previewRafId) return

      previewRafId = requestAnimationFrame(() => {
        previewRafId = 0
        if (!latestClientPoint) return
        updateSelectionRect(latestClientPoint)
      })
    }

    function tryActivateSelection(currentClientPoint: { x: number; y: number }) {
      if (!selectionStartClientPoint) return false

      const distance = Math.hypot(
        currentClientPoint.x - selectionStartClientPoint.x,
        currentClientPoint.y - selectionStartClientPoint.y,
      )
      if (!selectionActive && distance <= MIN_SELECTION_DRAG_DISTANCE_PX) {
        return false
      }

      return true
    }

    function stopTrackingSelection(commit: boolean) {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)

      if (commit && latestClientPoint && tryActivateSelection(latestClientPoint)) {
        updateSelectionRect(latestClientPoint)
      }

      if (commit && selectionActive && lastFlowRectRef.current) {
        const current = storeApi.getState()
        const selectedNodeIds = getCanvasNodesMatchingRectangle(
          getMeasuredCanvasNodesFromLookup(current.nodeLookup),
          lastFlowRectRef.current,
          { zoom: reactFlow.getZoom() },
        )
        interaction.suppressNextSurfaceClick()
        selectionRef.current.commitGestureSelection(selectedNodeIds)
      }

      selectionStartClientPoint = null
      selectionActive = false
      clearLocalSelectionGesture()
    }

    function handlePointerMove(event: PointerEvent) {
      if (!selectionStartClientPoint) return

      latestClientPoint = { x: event.clientX, y: event.clientY }
      if (!tryActivateSelection(latestClientPoint)) {
        return
      }

      scheduleSelectionPreviewUpdate()
    }

    function handlePointerUp() {
      if (!selectionStartClientPoint) return
      stopTrackingSelection(true)
    }

    function handlePointerCancel() {
      if (!selectionStartClientPoint) return
      stopTrackingSelection(false)
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.target !== pane) return

      selectionStartClientPoint = {
        x: event.clientX,
        y: event.clientY,
      }
      latestClientPoint = selectionStartClientPoint
      selectionActive = false
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerCancel)
    }

    pane.addEventListener('pointerdown', handlePointerDown)

    return () => {
      pane.removeEventListener('pointerdown', handlePointerDown)
      stopTrackingSelection(false)
    }
  }, [enabled, interaction, reactFlow, storeApi, surfaceRef])
}
