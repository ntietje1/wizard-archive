import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
import { boundsUnion } from './canvas-geometry-utils'
import type { Bounds } from './canvas-geometry-utils'

export function getCanvasFitViewport({
  height,
  maxZoom,
  minZoom,
  nodes,
  padding,
  width,
}: {
  nodes: ReadonlyArray<CanvasDocumentNode>
  width: number
  height: number
  minZoom: number
  maxZoom: number
  padding: number
}): CanvasViewport | null {
  const bounds = getCanvasContentBounds(nodes)
  if (!bounds) {
    return null
  }

  if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
    return null
  }

  const paddedWidth = bounds.width * (1 + padding * 2)
  const paddedHeight = bounds.height * (1 + padding * 2)
  if (paddedWidth <= 0 || paddedHeight <= 0) {
    return null
  }

  const rawZoom = Math.min(width / paddedWidth, height / paddedHeight)
  const [lowerZoom, upperZoom] = minZoom <= maxZoom ? [minZoom, maxZoom] : [maxZoom, minZoom]
  const zoom = Math.min(upperZoom, Math.max(lowerZoom, Number.isFinite(rawZoom) ? rawZoom : 1))
  return {
    x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  }
}

function getCanvasContentBounds(nodes: ReadonlyArray<CanvasDocumentNode>): Bounds | null {
  const boundsItems = nodes.flatMap((node) => {
    const nodeBounds = getCanvasNodeBounds(node)
    return nodeBounds ? [nodeBounds] : []
  })

  return boundsUnion(boundsItems)
}
