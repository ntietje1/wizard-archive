import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'

const EMBED_NODE_DEFAULT_SIZE = { width: 320, height: 240 } as const

export function resolveEmbedNodeDefaultSize(lockedAspectRatio: unknown = null) {
  if (
    typeof lockedAspectRatio !== 'number' ||
    !Number.isFinite(lockedAspectRatio) ||
    lockedAspectRatio <= 0
  ) {
    return EMBED_NODE_DEFAULT_SIZE
  }

  const minimumAspectRatio = CANVAS_NODE_MIN_SIZE / EMBED_NODE_DEFAULT_SIZE.height
  const maximumAspectRatio = EMBED_NODE_DEFAULT_SIZE.width / CANVAS_NODE_MIN_SIZE
  if (lockedAspectRatio < minimumAspectRatio || lockedAspectRatio > maximumAspectRatio) {
    return EMBED_NODE_DEFAULT_SIZE
  }

  const defaultAspectRatio = EMBED_NODE_DEFAULT_SIZE.width / EMBED_NODE_DEFAULT_SIZE.height
  if (lockedAspectRatio >= defaultAspectRatio) {
    return {
      width: EMBED_NODE_DEFAULT_SIZE.width,
      height: EMBED_NODE_DEFAULT_SIZE.width / lockedAspectRatio,
    }
  }

  return {
    width: EMBED_NODE_DEFAULT_SIZE.height * lockedAspectRatio,
    height: EMBED_NODE_DEFAULT_SIZE.height,
  }
}

export function resolveDefaultEmbedNodeResizeForLockedAspectRatio(
  node: {
    position: { x: number; y: number }
    width?: number
    height?: number
  },
  lockedAspectRatio: unknown,
) {
  if (
    node.width !== EMBED_NODE_DEFAULT_SIZE.width ||
    node.height !== EMBED_NODE_DEFAULT_SIZE.height
  ) {
    return null
  }

  const size = resolveEmbedNodeDefaultSize(lockedAspectRatio)
  if (size.width === node.width && size.height === node.height) {
    return null
  }

  return {
    position: { ...node.position },
    width: size.width,
    height: size.height,
  }
}
