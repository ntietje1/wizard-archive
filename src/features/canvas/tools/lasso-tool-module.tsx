import { Lasso } from 'lucide-react'
import {
  isStrokeNode,
  pointInPolygon,
  strokeNodeIntersectsPolygon,
} from '../utils/canvas-stroke-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'

export const lassoToolModule: CanvasToolModule<'lasso'> = {
  id: 'lasso',
  label: 'Lasso select',
  group: 'selection',
  icon: <Lasso className="h-4 w-4" />,
  cursor: 'crosshair',
  oneShot: true,
  showsStyleControls: false,
  create: (runtime) => {
    let points: Array<{ x: number; y: number }> = []
    let active = false
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const reset = () => {
      active = false
      points = []
      runtime.setLassoPath([])
      runtime.setLocalSelecting(null)
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
        const pos = screenEventToFlowPosition(runtime, event)
        points = [pos]
        runtime.setLassoPath(points)
        runtime.setLocalSelecting({ type: 'lasso', points })
        runtime.clearSelection()
      },
      onPointerMove: (event) => {
        if (!active || (event.buttons & 1) !== 1) return

        const pos = screenEventToFlowPosition(runtime, event)
        points.push(pos)
        runtime.setLassoPath(points)
        runtime.setLocalSelecting({ type: 'lasso', points })
      },
      onPointerUp: () => {
        if (!active) return

        if (points.length < 3) {
          reset()
          runtime.completeActiveToolAction()
          return
        }

        const selectedNodeIds = runtime
          .getMeasuredNodes()
          .filter((node) => {
            if (isStrokeNode(node)) {
              return strokeNodeIntersectsPolygon(node, points)
            }

            const width = node.width ?? 0
            const height = node.height ?? 0
            const corners = [
              { x: node.position.x, y: node.position.y },
              { x: node.position.x + width, y: node.position.y },
              { x: node.position.x + width, y: node.position.y + height },
              { x: node.position.x, y: node.position.y + height },
            ]

            return corners.every((corner) => pointInPolygon(corner.x, corner.y, points))
          })
          .map((node) => node.id)

        runtime.setNodeSelection(selectedNodeIds)
        reset()
        runtime.completeActiveToolAction()
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
