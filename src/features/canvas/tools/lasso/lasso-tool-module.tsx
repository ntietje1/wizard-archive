import { Lasso } from 'lucide-react'
import { getCanvasEdgesMatchingLasso } from '../../edges/canvas-edge-registry'
import { getCanvasNodesMatchingLasso } from '../../nodes/canvas-node-selection-queries'
import { createCanvasSelectionGestureSession } from '../../runtime/selection/canvas-selection-gesture-session'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToCanvasPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolSpec } from '../canvas-tool-types'
import { LassoAwarenessLayer } from './lasso-tool-awareness-layer'
import { setLassoToolAwareness } from './lasso-tool-awareness'
import { clearLassoToolLocalOverlay, setLassoToolLocalPoints } from './lasso-tool-local-overlay'
import { LassoToolLocalOverlayLayer } from './lasso-tool-local-overlay-layer'

export const lassoToolSpec: CanvasToolSpec<'lasso'> = {
  id: 'lasso',
  label: 'Lasso select',
  group: 'selection',
  icon: <Lasso className="h-4 w-4" />,
  cursor: 'crosshair',
  awareness: {
    Layer: LassoAwarenessLayer,
    clear: (presence) => setLassoToolAwareness(presence, null),
  },
  localOverlay: {
    Layer: LassoToolLocalOverlayLayer,
    clear: clearLassoToolLocalOverlay,
  },
  createHandlers: (services) => {
    let points: Array<{ x: number; y: number }> = []
    let active = false
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
        services.awareness.presence,
        nextPoints ? { type: 'lasso', points: nextPoints } : null,
      )
    }

    const previewSelection = (nextPoints: Array<{ x: number; y: number }>) => {
      publishLassoAwareness(nextPoints)
      if (nextPoints.length < 3) {
        return null
      }

      const pendingNodeIds = getCanvasNodesMatchingLasso(
        services.query.getMeasuredNodes(),
        nextPoints,
        {
          zoom: services.viewport.getZoom(),
        },
      )
      const pendingEdgeIds = getCanvasEdgesMatchingLasso(
        services.query.getNodes(),
        services.query.getEdges(),
        nextPoints,
        { zoom: services.viewport.getZoom() },
      )

      return {
        nodeIds: pendingNodeIds,
        edgeIds: pendingEdgeIds,
      }
    }

    const session = createCanvasSelectionGestureSession({
      adapter: {
        kind: 'lasso',
        startGestureOnBegin: true,
        sync: ({ points: nextPoints }: { points: Array<{ x: number; y: number }> }) => {
          setLassoToolLocalPoints(nextPoints)
        },
        preview: ({ points: nextPoints }: { points: Array<{ x: number; y: number }> }) =>
          previewSelection(nextPoints) ?? null,
        clear: () => {
          setLassoToolLocalPoints([])
          publishLassoAwareness(null)
        },
      },
      getSelection: () => services.selection,
      interaction: services.interaction,
      requestAnimationFrame,
      cancelAnimationFrame,
    })

    const reset = () => {
      active = false
      points = []
      session.cancel()
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    const claimPointerEvent = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        claimPointerEvent(event)
        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        active = true
        const pos = screenEventToCanvasPosition(services.viewport, event)
        points = [pos]
        session.begin({ points }, isPrimarySelectionModifier(event) ? 'add' : 'replace')
      },
      onPointerMove: (event) => {
        if (!active) return

        claimPointerEvent(event)
        const pos = screenEventToCanvasPosition(services.viewport, event)
        points = [...points, pos]
        session.update({ points })
      },
      onPointerUp: (event) => {
        if (!active) return

        claimPointerEvent(event)
        if (points.length === 1) {
          services.selection.clearSelection()
          reset()
          return
        }

        session.commit({ points })
        reset()
      },
      onPointerCancel: (event) => {
        if (active) {
          claimPointerEvent(event)
        }
        reset()
      },
    }
  },
}
