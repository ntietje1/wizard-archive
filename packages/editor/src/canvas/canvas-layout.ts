import type { CanvasDocumentNode } from './document-contract'
import {
  CANVAS_EMBED_NODE_DEFAULT_SIZE,
  CANVAS_TEXT_NODE_DEFAULT_SIZE,
} from './canvas-node-defaults'
import { canvasToScreenPoint } from './canvas-viewport'
import type { CanvasViewport } from './interaction-types'

export function canvasNodeSize(node: CanvasDocumentNode) {
  if (node.type === 'stroke') {
    return {
      width: node.width ?? node.data.bounds.width,
      height: node.height ?? node.data.bounds.height,
    }
  }
  const fallback =
    node.type === 'embed' ? CANVAS_EMBED_NODE_DEFAULT_SIZE : CANVAS_TEXT_NODE_DEFAULT_SIZE
  return { width: node.width ?? fallback.width, height: node.height ?? fallback.height }
}

export function fitCanvasContent(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  surfaceWidth: number,
  surfaceHeight: number,
): CanvasViewport | null {
  const visible = nodes.filter((node) => !node.hidden)
  if (visible.length === 0 || surfaceWidth <= 0 || surfaceHeight <= 0) return null
  const bounds = visible.reduce(
    (result, node) => {
      const size = canvasNodeSize(node)
      return {
        left: Math.min(result.left, node.position.x),
        top: Math.min(result.top, node.position.y),
        right: Math.max(result.right, node.position.x + size.width),
        bottom: Math.max(result.bottom, node.position.y + size.height),
      }
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  )
  const width = Math.max(1, bounds.right - bounds.left)
  const height = Math.max(1, bounds.bottom - bounds.top)
  const padding = 48
  const zoom = Math.min(
    4,
    Math.max(
      0.1,
      Math.min((surfaceWidth - padding * 2) / width, (surfaceHeight - padding * 2) / height),
    ),
  )
  const center = canvasToScreenPoint(
    { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
    { x: 0, y: 0, zoom },
  )
  return { x: surfaceWidth / 2 - center.x, y: surfaceHeight / 2 - center.y, zoom }
}
