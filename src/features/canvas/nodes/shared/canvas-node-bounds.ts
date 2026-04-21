import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Node } from '@xyflow/react'

type BoundsLike = { width: number; height: number }

function isBoundsLike(value: unknown): value is BoundsLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'width' in value &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height)
  )
}

export function getCanvasNodeBounds(node: Node): Bounds | null {
  const fallbackBounds =
    typeof node.data === 'object' && node.data !== null && 'bounds' in node.data
      ? node.data.bounds
      : null
  const fallbackHasBounds = isBoundsLike(fallbackBounds)
  const width = node.width ?? (fallbackHasBounds ? fallbackBounds.width : null)
  const height = node.height ?? (fallbackHasBounds ? fallbackBounds.height : null)

  if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}
