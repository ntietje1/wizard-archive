import { Lasso } from 'lucide-react'
import { getCanvasNodesMatchingLasso } from '../../nodes/canvas-node-registry'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import { useCanvasSelectionState } from '../../hooks/useCanvasSelectionState'
import type { CanvasToolModule } from '../canvas-tool-types'
import { LassoAwarenessLayer } from './lasso-tool-awareness-layer'

export const lassoToolModule: CanvasToolModule<'lasso'> = {
  id: 'lasso',
  label: 'Lasso select',
  group: 'selection',
  icon: <Lasso className="h-4 w-4" />,
  cursor: 'crosshair',
  awareness: {
    Layer: LassoAwarenessLayer,
  },
  create: (environment) => {
    let points: Array<{ x: number; y: number }> = []
    let active = false
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const publishLassoPoints = () => {
      const nextPoints = [...points]
      environment.interaction.setLassoPath(nextPoints)
      environment.awareness.setLocalSelecting({ type: 'lasso', points: nextPoints })
    }

    const reset = () => {
      active = false
      points = []
      environment.interaction.setLassoPath([])
      environment.awareness.setLocalSelecting(null)
      useCanvasSelectionState.getState().setSelectionPhase('idle')
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
        useCanvasSelectionState.getState().setSelectionPhase('lasso')
        publishLassoPoints()
        environment.selection.clearSelection()
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1) return

        const pos = screenEventToFlowPosition(environment.viewport, event)
        points.push(pos)
        publishLassoPoints()
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

        environment.selection.setNodeSelection(selectedNodeIds)
        reset()
        environment.toolState.setActiveTool('select')
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
