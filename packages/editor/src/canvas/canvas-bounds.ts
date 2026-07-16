import { canvasNodeSize } from './canvas-layout'
import type { CanvasDocumentNode } from './document-contract'

export type CanvasBounds = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export function canvasNodeBounds(node: CanvasDocumentNode): CanvasBounds {
  const size = canvasNodeSize(node)
  return { x: node.position.x, y: node.position.y, width: size.width, height: size.height }
}

export function canvasBoundsUnion(bounds: ReadonlyArray<CanvasBounds>): CanvasBounds | null {
  if (bounds.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const value of bounds) {
    left = Math.min(left, value.x)
    top = Math.min(top, value.y)
    right = Math.max(right, value.x + value.width)
    bottom = Math.max(bottom, value.y + value.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}
