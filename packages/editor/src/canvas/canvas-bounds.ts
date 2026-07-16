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
  const left = Math.min(...bounds.map((value) => value.x))
  const top = Math.min(...bounds.map((value) => value.y))
  const right = Math.max(...bounds.map((value) => value.x + value.width))
  const bottom = Math.max(...bounds.map((value) => value.y + value.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}
