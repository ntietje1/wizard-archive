import { getCanvasEdgesMatchingRectangle } from '../../edges/canvas-edge-registry'
import { getCanvasNodesMatchingRectangle } from '../../nodes/canvas-node-registry'
import { setSelectToolAwareness } from '../../tools/select/select-tool-awareness'
import { setSelectToolSelectionDragRect } from '../../tools/select/select-tool-local-overlay'
import { applyCanvasSelectionCommitMode } from '../../utils/canvas-selection-utils'
import type { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from './use-canvas-pending-selection-preview'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionCommitMode,
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'
import type { Bounds } from '../../utils/canvas-geometry-utils'

const MIN_SELECTION_DRAG_DISTANCE_PX = 1

type ClientPoint = { x: number; y: number }

interface CanvasSelectionGestureControllerOptions {
  reactFlow: Pick<ReactFlowInstance, 'getEdges' | 'getNodes' | 'getZoom' | 'screenToFlowPosition'>
  getMeasuredNodes: () => ReturnType<typeof getMeasuredCanvasNodesFromLookup>
  getAwareness: () => CanvasAwarenessPresenceWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  getSelection: () => Pick<
    CanvasSelectionController,
    | 'beginGesture'
    | 'commitGestureSelection'
    | 'endGesture'
    | 'getSelectedNodeIds'
    | 'getSelectedEdgeIds'
  >
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}

export interface CanvasSelectionGestureController {
  begin: (point: ClientPoint, mode: CanvasSelectionCommitMode) => void
  update: (point: ClientPoint) => void
  commit: () => void
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
}

function clientRectToFlowRect(
  clientRect: { left: number; top: number; right: number; bottom: number },
  flow: Pick<ReactFlowInstance, 'screenToFlowPosition'>,
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

export function createCanvasSelectionGestureController({
  reactFlow,
  getMeasuredNodes,
  getAwareness,
  interaction,
  getSelection,
  requestAnimationFrame,
  cancelAnimationFrame,
}: CanvasSelectionGestureControllerOptions): CanvasSelectionGestureController {
  let selectionStartClientPoint: ClientPoint | null = null
  let latestClientPoint: ClientPoint | null = null
  let selectionActive = false
  let previewRafId = 0
  let selectionCommitMode: CanvasSelectionCommitMode = 'replace'
  let gestureStartSelection: CanvasSelectionSnapshot = { nodeIds: [], edgeIds: [] }
  let lastPublishedRect: Bounds | null = null
  let lastFlowRect: Bounds | null = null
  let lastFlowSelection: CanvasSelectionSnapshot = { nodeIds: [], edgeIds: [] }

  function publishSelectToolAwareness(rect: Bounds | null) {
    if (boundsEqual(lastPublishedRect, rect)) return
    lastPublishedRect = rect
    setSelectToolAwareness(getAwareness(), rect)
  }

  function cancelSelectionPreviewFrame() {
    if (!previewRafId) return
    cancelAnimationFrame(previewRafId)
    previewRafId = 0
  }

  function clearLocalSelectionGesture() {
    cancelSelectionPreviewFrame()
    lastFlowRect = null
    lastFlowSelection = { nodeIds: [], edgeIds: [] }
    gestureStartSelection = { nodeIds: [], edgeIds: [] }
    selectionCommitMode = 'replace'
    latestClientPoint = null
    setSelectToolSelectionDragRect(null)
    clearCanvasPendingSelectionPreview()
    getSelection().endGesture()
    publishSelectToolAwareness(null)
  }

  function tryActivateSelection(currentClientPoint: ClientPoint) {
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

  function updateSelectionRect(currentClientPoint: ClientPoint) {
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

    lastFlowRect = flowRect
    setSelectToolSelectionDragRect(flowRect)
    if (!selectionActive) {
      selectionActive = true
      getSelection().beginGesture('marquee')
    }
    publishSelectToolAwareness(flowRect)

    lastFlowSelection = {
      nodeIds: getCanvasNodesMatchingRectangle(getMeasuredNodes(), flowRect, {
        zoom: reactFlow.getZoom(),
      }),
      edgeIds: getCanvasEdgesMatchingRectangle(
        reactFlow.getNodes(),
        reactFlow.getEdges(),
        flowRect,
        { zoom: reactFlow.getZoom() },
      ),
    }
    setCanvasPendingSelectionPreview(
      applyCanvasSelectionCommitMode({
        currentSelection: gestureStartSelection,
        nextSelection: lastFlowSelection,
        mode: selectionCommitMode,
      }),
    )
  }

  function scheduleSelectionPreviewUpdate() {
    if (previewRafId) return

    previewRafId = requestAnimationFrame(() => {
      previewRafId = 0
      if (!latestClientPoint) return
      updateSelectionRect(latestClientPoint)
    })
  }

  return {
    begin: (point, mode) => {
      const selection = getSelection()
      selectionStartClientPoint = point
      latestClientPoint = point
      selectionActive = false
      selectionCommitMode = mode
      gestureStartSelection = {
        nodeIds: selection.getSelectedNodeIds(),
        edgeIds: selection.getSelectedEdgeIds(),
      }
    },
    update: (point) => {
      if (!selectionStartClientPoint) return

      latestClientPoint = point
      if (!tryActivateSelection(point)) {
        return
      }

      scheduleSelectionPreviewUpdate()
    },
    commit: () => {
      if (!selectionStartClientPoint) return

      if (latestClientPoint && tryActivateSelection(latestClientPoint)) {
        updateSelectionRect(latestClientPoint)
      }

      if (selectionActive && lastFlowRect) {
        interaction.suppressNextSurfaceClick()
        getSelection().commitGestureSelection(lastFlowSelection, selectionCommitMode)
      }

      selectionStartClientPoint = null
      selectionActive = false
      clearLocalSelectionGesture()
    },
    cancel: () => {
      if (!selectionStartClientPoint) return

      selectionStartClientPoint = null
      selectionActive = false
      clearLocalSelectionGesture()
    },
    dispose: () => {
      selectionStartClientPoint = null
      selectionActive = false
      clearLocalSelectionGesture()
    },
    isTracking: () => selectionStartClientPoint !== null,
  }
}
