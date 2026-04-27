import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import type { CanvasNode, CanvasViewport } from '../types/canvas-domain-types'
import type { Bounds } from './canvas-geometry-utils'

export function getCanvasFitViewport({
  height,
  maxZoom,
  minZoom,
  nodes,
  padding,
  width,
}: {
  nodes: ReadonlyArray<CanvasNode>
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

function getCanvasContentBounds(nodes: ReadonlyArray<CanvasNode>): Bounds | null {
  let bounds: Bounds | null = null

  for (const node of nodes) {
    const nodeBounds = getCanvasNodeBounds(node)
    if (!nodeBounds) {
      continue
    }

    if (!bounds) {
      bounds = nodeBounds
      continue
    }

    const minX = Math.min(bounds.x, nodeBounds.x)
    const minY = Math.min(bounds.y, nodeBounds.y)
    const maxX = Math.max(bounds.x + bounds.width, nodeBounds.x + nodeBounds.width)
    const maxY = Math.max(bounds.y + bounds.height, nodeBounds.y + nodeBounds.height)
    bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  return bounds
}
