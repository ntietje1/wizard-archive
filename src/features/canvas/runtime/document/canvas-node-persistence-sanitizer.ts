import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasNode as Node } from '~/features/canvas/types/canvas-domain-types'
import {
  parseCanvasAwarenessPresence,
  parseCanvasPoint2D,
  parsePersistedCanvasNode,
} from 'convex/canvases/validation'
import type { PersistedCanvasNodeValue } from 'convex/canvases/validation'
import { logger } from '~/shared/utils/logger'

function buildSafePersistedCanvasNode(node: Node): PersistedCanvasNodeValue {
  const safeNode: PersistedCanvasNodeValue = {
    id: node.id,
    position: parseCanvasPoint2D(node.position) ?? { x: 0, y: 0 },
    data: parseCanvasAwarenessPresence(node.data) ?? {},
  }

  if (typeof node.type === 'string') {
    safeNode.type = node.type
  }
  const width = typeof node.width === 'number' && Number.isFinite(node.width) ? node.width : null
  if (width !== null) {
    safeNode.width = width
  }
  const height =
    typeof node.height === 'number' && Number.isFinite(node.height) ? node.height : null
  if (height !== null) {
    safeNode.height = height
  }

  return safeNode
}

export function sanitizeNodeForPersistence(
  node: Node,
  operation: string,
  fallbackNode: Node = node,
): PersistedCanvasNodeValue {
  try {
    const persistedNode = stripEphemeralCanvasNodeState(node)
    const parsedNode = parsePersistedCanvasNode(persistedNode)
    if (!parsedNode) {
      throw new TypeError('parsePersistedCanvasNode rejected the stripped canvas node shape')
    }
    return parsedNode
  } catch (error) {
    logger.error('Canvas node persistence sanitization failed', {
      operation,
      nodeId: node.id,
      nodeType: node.type,
      error,
    })
    return buildSafePersistedCanvasNode(fallbackNode)
  }
}
