import { CANVAS_EMBED_NODE_DEFAULT_SIZE } from './canvas-node-defaults'
import { canvasNodeSize } from './canvas-layout'
import type { CanvasDocumentNodeUpdate } from './document-controller'
import type { CanvasDocumentNode } from './document-contract'
import type { EmbedMediaLayout } from '../resources/embed-media-layout'
import { mediaLayoutAspectRatio } from '../resources/embed-media-layout'

const CANVAS_EMBED_NODE_MIN_SIZE = { width: 96, height: 72 } as const

export function canvasEmbedMediaLayoutUpdate(
  node: Extract<CanvasDocumentNode, { type: 'embed' }>,
  layout: EmbedMediaLayout,
): CanvasDocumentNodeUpdate | null {
  const aspectRatio = mediaLayoutAspectRatio(layout)
  if (layout.kind === 'fixedHeight') {
    const size = canvasNodeSize(node)
    if (node.data.lockedAspectRatio === undefined && size.height === layout.height) return null
    return {
      id: node.id,
      type: 'embed',
      data: { lockedAspectRatio: undefined },
      height: layout.height,
      width: size.width,
    }
  }

  if (aspectRatio === null) {
    return node.data.lockedAspectRatio === undefined
      ? null
      : { id: node.id, type: 'embed', data: { lockedAspectRatio: undefined } }
  }
  const defaultSize = defaultEmbedSizeForAspectRatio(aspectRatio)
  const usesDefaultSize =
    (node.width === undefined && node.height === undefined) ||
    (node.width === CANVAS_EMBED_NODE_DEFAULT_SIZE.width &&
      node.height === CANVAS_EMBED_NODE_DEFAULT_SIZE.height)
  if (node.data.lockedAspectRatio === aspectRatio && !usesDefaultSize) return null
  return {
    id: node.id,
    type: 'embed',
    data: { lockedAspectRatio: aspectRatio },
    ...(usesDefaultSize ? defaultSize : {}),
  }
}

function defaultEmbedSizeForAspectRatio(aspectRatio: number) {
  const minimumAspectRatio =
    CANVAS_EMBED_NODE_MIN_SIZE.width / CANVAS_EMBED_NODE_DEFAULT_SIZE.height
  const maximumAspectRatio =
    CANVAS_EMBED_NODE_DEFAULT_SIZE.width / CANVAS_EMBED_NODE_MIN_SIZE.height
  if (aspectRatio < minimumAspectRatio || aspectRatio > maximumAspectRatio) {
    return CANVAS_EMBED_NODE_DEFAULT_SIZE
  }
  const defaultAspectRatio =
    CANVAS_EMBED_NODE_DEFAULT_SIZE.width / CANVAS_EMBED_NODE_DEFAULT_SIZE.height
  return aspectRatio >= defaultAspectRatio
    ? {
        width: CANVAS_EMBED_NODE_DEFAULT_SIZE.width,
        height: CANVAS_EMBED_NODE_DEFAULT_SIZE.width / aspectRatio,
      }
    : {
        width: CANVAS_EMBED_NODE_DEFAULT_SIZE.height * aspectRatio,
        height: CANVAS_EMBED_NODE_DEFAULT_SIZE.height,
      }
}
