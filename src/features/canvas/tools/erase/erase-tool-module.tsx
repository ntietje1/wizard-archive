import { Eraser } from 'lucide-react'
import { polylineIntersectsStroke } from '../../nodes/stroke/stroke-node-interactions'
import { getAbsoluteStrokePointsForNode, isStrokeNode } from '../../nodes/stroke/stroke-node-model'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToFlowPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
import {
  clearEraseToolLocalOverlay,
  setEraseToolErasingStrokeIds,
} from './erase-tool-local-overlay'

export const eraseToolModule: CanvasToolModule<'erase'> = {
  id: 'erase',
  label: 'Eraser',
  group: 'creation',
  icon: <Eraser className="h-4 w-4" />,
  cursor: 'cell',
  localOverlay: {
    clear: clearEraseToolLocalOverlay,
  },
  create: (services) => {
    let trail: Array<{ x: number; y: number }> = []
    let marked = new Set<string>()
    let erasing = false
    let rafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null

    const testIntersections = () => {
      if (trail.length < 2) return

      const strokeNodes = services.query.getNodes().filter(isStrokeNode)
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
        setEraseToolErasingStrokeIds(new Set(marked))
      }
    }

    const reset = () => {
      erasing = false
      marked = new Set()
      trail = []
      setEraseToolErasingStrokeIds(new Set())
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
        const pos = screenEventToFlowPosition(services.viewport, event)
        trail = [pos]
        setEraseToolErasingStrokeIds(new Set())
      },
      onPointerMove: (event) => {
        if (!erasing || (event.buttons & 1) !== 1) return

        trail = [...trail.slice(-199), screenEventToFlowPosition(services.viewport, event)]
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
          services.commands.deleteNodes(Array.from(marked))
        }
        reset()
      },
      onPointerCancel: () => {
        reset()
      },
    }
  },
}
