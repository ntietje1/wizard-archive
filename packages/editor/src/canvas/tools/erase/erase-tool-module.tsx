import { Eraser } from 'lucide-react'
import { polylineIntersectsStroke } from '../../nodes/stroke/stroke-node-interactions'
import { getAbsoluteStrokePointsForNode, isStrokeNode } from '../../nodes/stroke/stroke-node-model'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import {
  setPointerCapture,
  releasePointerCapture,
  screenEventToCanvasPosition,
} from '../shared/tool-module-utils'
import type { CanvasToolSpec } from '../canvas-tool-types'

export const eraseToolSpec: CanvasToolSpec<'erase'> = {
  id: 'erase',
  label: 'Eraser',
  group: 'creation',
  icon: <Eraser className="h-4 w-4" />,
  cursor: 'cell',
  createHandlers: (services) => {
    let trail: Array<{ x: number; y: number }> = []
    let marked = new Set<string>()
    let erasing = false
    let rafId = 0
    let captureTarget: Element | null = null
    let pointerId: number | null = null
    let testedTrailPointCount = 0

    const trailBounds = (points: ReadonlyArray<{ x: number; y: number }>): Bounds => {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const point of points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }

      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }

    const absoluteStrokeBounds = (node: ReturnType<typeof services.query.getNodes>[number]) => {
      if (!isStrokeNode(node)) return null
      const offsetX = node.position.x - node.data.bounds.x
      const offsetY = node.position.y - node.data.bounds.y
      return {
        x: node.data.bounds.x + offsetX,
        y: node.data.bounds.y + offsetY,
        width: node.data.bounds.width,
        height: node.data.bounds.height,
      } satisfies Bounds
    }

    const boundsIntersect = (a: Bounds, b: Bounds) =>
      a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y

    const testIntersections = () => {
      const trailStartIndex = Math.max(0, testedTrailPointCount - 1)
      const untestedTrail = trail.slice(trailStartIndex)
      if (untestedTrail.length < 2) return

      const currentTrailBounds = trailBounds(untestedTrail)
      const strokeNodes = services.query.getNodes().filter(isStrokeNode)
      let changed = false
      for (const node of strokeNodes) {
        if (marked.has(node.id)) continue
        const candidateBounds = absoluteStrokeBounds(node)
        if (!candidateBounds || !boundsIntersect(currentTrailBounds, candidateBounds)) continue

        const absolutePoints = getAbsoluteStrokePointsForNode(node)
        if (
          polylineIntersectsStroke(untestedTrail, {
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

      testedTrailPointCount = trail.length
      if (trail.length > 200) {
        const removedPointCount = trail.length - 200
        trail = trail.slice(removedPointCount)
        testedTrailPointCount = Math.max(0, testedTrailPointCount - removedPointCount)
      }

      if (changed) {
        services.localOverlay.setEraseErasingStrokeIds(marked)
      }
    }

    const reset = () => {
      erasing = false
      marked = new Set()
      trail = []
      testedTrailPointCount = 0
      services.localOverlay.clearErase()
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      releasePointerCapture(captureTarget, pointerId)
      captureTarget = null
      pointerId = null
    }

    const isActivePointer = (event: PointerEvent) => erasing && event.pointerId === pointerId

    return {
      onPointerDown: (event) => {
        if (erasing || event.button !== 0) return

        captureTarget = setPointerCapture(event)
        pointerId = event.pointerId
        erasing = true
        marked = new Set()
        const pos = screenEventToCanvasPosition(services.viewport, event)
        trail = [pos]
        testedTrailPointCount = 0
        services.localOverlay.clearErase()
      },
      onPointerMove: (event) => {
        if (!isActivePointer(event) || (event.buttons & 1) !== 1) return

        trail = [...trail, screenEventToCanvasPosition(services.viewport, event)]
        if (rafId) return

        rafId = requestAnimationFrame(() => {
          rafId = 0
          testIntersections()
        })
      },
      onPointerUp: (event) => {
        if (!isActivePointer(event)) return

        if (rafId) {
          cancelAnimationFrame(rafId)
          rafId = 0
        }
        testIntersections()
        if (marked.size > 0) {
          services.commands.deleteNodes(marked)
        }
        reset()
      },
      onPointerCancel: (event) => {
        if (!isActivePointer(event)) return
        reset()
      },
    }
  },
}
