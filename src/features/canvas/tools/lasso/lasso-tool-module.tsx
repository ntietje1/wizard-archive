import { Lasso } from 'lucide-react'
import { getCanvasNodesMatchingLasso } from '../../nodes/canvas-node-registry'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
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
  create: (environment) => {
    let points: Array<{ x: number; y: number }> = []
    let active = false
    let previewRafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null
    let lastPublishedPoints: Array<{ x: number; y: number }> | null = null

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
        environment.awareness.presence,
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

      setCanvasPendingSelectionPreview(
        getCanvasNodesMatchingLasso(environment.document.getMeasuredNodes(), points, {
          zoom: environment.viewport.getZoom(),
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
      environment.selection.endGesture()
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        active = true
        const pos = screenEventToFlowPosition(environment.viewport, event)
        points = [pos]
        environment.selection.beginGesture('lasso')
        setLassoToolLocalPoints(points)
        schedulePreview()
        environment.selection.clear()
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1) return

        const pos = screenEventToFlowPosition(environment.viewport, event)
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
          environment.toolState.setActiveTool('select')
          return
        }

        const selectedNodeIds = getCanvasNodesMatchingLasso(
          environment.document.getMeasuredNodes(),
          points,
          { zoom: environment.viewport.getZoom() },
        )

        environment.interaction.suppressNextSurfaceClick()
        environment.selection.commitGestureSelection(selectedNodeIds)
        reset()
        environment.toolState.setActiveTool('select')
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
