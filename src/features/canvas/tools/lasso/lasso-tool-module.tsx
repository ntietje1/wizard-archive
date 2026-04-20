import { Lasso } from 'lucide-react'
import { getCanvasEdgesMatchingLasso } from '../../edges/canvas-edge-registry'
import { getCanvasNodesMatchingLasso } from '../../nodes/canvas-node-registry'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import {
  applyCanvasSelectionCommitMode,
  isPrimarySelectionModifier,
} from '../../utils/canvas-selection-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import type {
  CanvasToolModule,
  CanvasSelectionCommitMode,
  CanvasSelectionSnapshot,
} from '../canvas-tool-types'
import { LassoAwarenessLayer } from './lasso-tool-awareness-layer'
import { setLassoToolAwareness } from './lasso-tool-awareness'
import { clearLassoToolLocalOverlay, setLassoToolLocalPoints } from './lasso-tool-local-overlay'
import { LassoToolLocalOverlayLayer } from './lasso-tool-local-overlay-layer'
export const lassoToolModule: CanvasToolModule<'lasso'> = {
  id: 'lasso',
  label: 'Lasso select',
  group: 'selection',
  icon: <Lasso className="h-4 w-4" />,
  cursor: 'crosshair',
  awareness: {
    Layer: LassoAwarenessLayer,
  },
  localOverlay: {
    Layer: LassoToolLocalOverlayLayer,
    clear: clearLassoToolLocalOverlay,
  },
  create: (services) => {
    let points: Array<{ x: number; y: number }> = []
    let active = false
    let previewRafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null
    let lastPublishedPoints: Array<{ x: number; y: number }> | null = null
    let selectionCommitMode: CanvasSelectionCommitMode = 'replace'
    let gestureStartSelection: CanvasSelectionSnapshot = { nodeIds: [], edgeIds: [] }

    const pointsEqual = (
      a: Array<{ x: number; y: number }> | null,
      b: Array<{ x: number; y: number }> | null,
    ) => {
      if (a === b) return true
      if (a === null || b === null) return false
      if (a.length !== b.length) return false

      for (let index = 0; index < a.length; index += 1) {
        if (a[index].x !== b[index].x || a[index].y !== b[index].y) {
          return false
        }
      }

      return true
    }

    const publishLassoAwareness = (nextPoints: Array<{ x: number; y: number }> | null) => {
      if (pointsEqual(lastPublishedPoints, nextPoints)) return

      lastPublishedPoints = nextPoints
      setLassoToolAwareness(
        services.awareness.presence,
        nextPoints ? { type: 'lasso', points: nextPoints } : null,
      )
    }

    const publishPreview = () => {
      previewRafId = 0

      publishLassoAwareness(points)
      if (points.length < 3) {
        clearCanvasPendingSelectionPreview()
        return
      }

      const pendingNodeIds = getCanvasNodesMatchingLasso(
        services.document.getMeasuredNodes(),
        points,
        {
          zoom: services.viewport.getZoom(),
        },
      )
      const pendingEdgeIds = getCanvasEdgesMatchingLasso(
        services.document.getNodes(),
        services.document.getEdges(),
        points,
        { zoom: services.viewport.getZoom() },
      )

      setCanvasPendingSelectionPreview(
        applyCanvasSelectionCommitMode({
          currentSelection: gestureStartSelection,
          nextSelection: { nodeIds: pendingNodeIds, edgeIds: pendingEdgeIds },
          mode: selectionCommitMode,
        }),
      )
    }

    const schedulePreview = () => {
      if (previewRafId) return
      previewRafId = requestAnimationFrame(publishPreview)
    }

    const reset = () => {
      active = false
      points = []
      if (previewRafId) {
        cancelAnimationFrame(previewRafId)
        previewRafId = 0
      }
      setLassoToolLocalPoints([])
      clearCanvasPendingSelectionPreview()
      publishLassoAwareness(null)
      services.selection.endGesture()
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
      selectionCommitMode = 'replace'
      gestureStartSelection = { nodeIds: [], edgeIds: [] }
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        active = true
        selectionCommitMode = isPrimarySelectionModifier(event) ? 'add' : 'replace'
        gestureStartSelection = {
          nodeIds: services.selection.getSelectedNodeIds(),
          edgeIds: services.selection.getSelectedEdgeIds(),
        }
        const pos = screenEventToFlowPosition(services.viewport, event)
        points = [pos]
        services.selection.beginGesture('lasso')
        setLassoToolLocalPoints(points)
        schedulePreview()
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1) return

        const pos = screenEventToFlowPosition(services.viewport, event)
        points = [...points, pos]
        setLassoToolLocalPoints(points)
        schedulePreview()
      },
      onPointerUp: () => {
        if (!active) return

        if (previewRafId) {
          cancelAnimationFrame(previewRafId)
          previewRafId = 0
        }

        if (points.length < 3) {
          reset()
          return
        }

        const measuredNodes = services.document.getMeasuredNodes()
        const selectedNodeIds = getCanvasNodesMatchingLasso(measuredNodes, points, {
          zoom: services.viewport.getZoom(),
        })
        const selectedEdgeIds = getCanvasEdgesMatchingLasso(
          services.document.getNodes(),
          services.document.getEdges(),
          points,
          { zoom: services.viewport.getZoom() },
        )

        services.interaction.suppressNextSurfaceClick()
        services.selection.commitGestureSelection(
          {
            nodeIds: selectedNodeIds,
            edgeIds: selectedEdgeIds,
          },
          selectionCommitMode,
        )
        reset()
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
