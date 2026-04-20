import { getCanvasEdgesMatchingRectangle } from '../../edges/canvas-edge-registry'
import { getCanvasNodesMatchingRectangle } from '../../nodes/canvas-node-registry'
import { setSelectToolAwareness } from '../../tools/select/select-tool-awareness'
import { setSelectToolSelectionDragRect } from '../../tools/select/select-tool-local-overlay'
import { getConstrainedRectFromPoints } from '../../utils/canvas-constraint-utils'
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
  update: (point: ClientPoint, options?: { square: boolean }) => void
  refresh: (options?: { square: boolean }) => void
  commit: (options?: { square: boolean }) => void
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
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
  let latestGestureState: { point: ClientPoint; square: boolean } | null = null
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
    latestGestureState = null
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

  function updateSelectionRect(currentClientPoint: ClientPoint, { square }: { square: boolean }) {
    if (!selectionStartClientPoint) return

    const flowRect = getConstrainedRectFromPoints(
      reactFlow.screenToFlowPosition(selectionStartClientPoint),
      reactFlow.screenToFlowPosition(currentClientPoint),
      { square },
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
      if (!latestGestureState) return
      updateSelectionRect(latestGestureState.point, { square: latestGestureState.square })
    })
  }

  return {
    begin: (point, mode) => {
      const selection = getSelection()
      selectionStartClientPoint = point
      latestGestureState = { point, square: false }
      selectionActive = false
      selectionCommitMode = mode
      gestureStartSelection = {
        nodeIds: selection.getSelectedNodeIds(),
        edgeIds: selection.getSelectedEdgeIds(),
      }
    },
    update: (point, options = { square: false }) => {
      if (!selectionStartClientPoint) return

      latestGestureState = { point, square: options.square }
      const currentPoint = latestGestureState.point
      if (!tryActivateSelection(currentPoint)) {
        return
      }

      scheduleSelectionPreviewUpdate()
    },
    refresh: (options = { square: false }) => {
      if (!selectionStartClientPoint || !latestGestureState) return

      latestGestureState = {
        ...latestGestureState,
        square: options.square,
      }
      if (!tryActivateSelection(latestGestureState.point)) {
        return
      }

      scheduleSelectionPreviewUpdate()
    },
    commit: (options = { square: false }) => {
      if (!selectionStartClientPoint) return

      const currentPoint = latestGestureState?.point
      if (currentPoint && tryActivateSelection(currentPoint)) {
        updateSelectionRect(currentPoint, options)
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
