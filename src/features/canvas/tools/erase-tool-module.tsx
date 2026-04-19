import { Eraser } from 'lucide-react'
import { polylineIntersectsStroke } from '../components/nodes/stroke-node-interactions'
import { getAbsoluteStrokePointsForNode, isStrokeNode } from '../components/nodes/stroke-node-model'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'

export const eraseToolModule: CanvasToolModule<'erase'> = {
  id: 'erase',
  label: 'Eraser',
  group: 'creation',
  icon: <Eraser className="h-4 w-4" />,
  cursor: 'cell',
  create: (environment) => {
    let trail: Array<{ x: number; y: number }> = []
    let marked = new Set<string>()
    let erasing = false
    let rafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const testIntersections = () => {
      if (trail.length < 2) return

      const strokeNodes = environment.document.getNodes().filter(isStrokeNode)
      let changed = false
      for (const node of strokeNodes) {
        if (marked.has(node.id)) continue

        const absolutePoints = getAbsoluteStrokePointsForNode(node)
        if (
          polylineIntersectsStroke(trail, {
            id: node.id,
            color: node.data.color,
            size: node.data.size,
            points: absolutePoints,
          })
        ) {
          marked.add(node.id)
          changed = true
        }
      }

      if (changed) {
        environment.interaction.setErasingStrokeIds(new Set(marked))
      }
    }

    const reset = () => {
      erasing = false
      marked = new Set()
      trail = []
      environment.interaction.setErasingStrokeIds(new Set())
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    return {
      onPointerDown: (event) => {
        if (event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        erasing = true
        marked = new Set()
        const pos = screenEventToFlowPosition(environment.viewport, event)
        trail = [pos]
        environment.interaction.setErasingStrokeIds(new Set())
      },
      onPointerMove: (event) => {
        if (!erasing || (event.buttons & 1) !== 1) return

        trail = [...trail.slice(-199), screenEventToFlowPosition(environment.viewport, event)]
        if (rafId) return

        rafId = requestAnimationFrame(() => {
          rafId = 0
          testIntersections()
        })
      },
      onPointerUp: () => {
        if (!erasing) return

        if (rafId) {
          cancelAnimationFrame(rafId)
          rafId = 0
        }
        testIntersections()
        if (marked.size > 0) {
          environment.document.deleteNodes(Array.from(marked))
        }
        reset()
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
