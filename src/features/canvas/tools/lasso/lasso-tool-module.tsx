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
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const publishLassoPoints = () => {
      const nextPoints = [...points]
      setLassoToolLocalPoints(nextPoints)
      setLassoToolAwareness(environment.awareness.presence, { type: 'lasso', points: nextPoints })
    }

    const reset = () => {
      active = false
      points = []
      setLassoToolLocalPoints([])
      clearCanvasPendingSelectionPreview()
      setLassoToolAwareness(environment.awareness.presence, null)
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
        publishLassoPoints()
        environment.selection.clear()
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1) return

        const pos = screenEventToFlowPosition(environment.viewport, event)
        points.push(pos)
        publishLassoPoints()

        if (points.length < 3) {
          clearCanvasPendingSelectionPreview()
          return
        }

        setCanvasPendingSelectionPreview(
          getCanvasNodesMatchingLasso(environment.document.getMeasuredNodes(), points, {
            zoom: environment.viewport.getZoom(),
          }),
        )
      },
      onPointerUp: () => {
        if (!active) return

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
