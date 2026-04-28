import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasDocumentNode } from '~/features/canvas/types/canvas-domain-types'
import {
  parseCanvasNodeDataByType,
  parseCanvasNodeType,
  parseCanvasPoint2D,
  parseCanvasDocumentNode,
} from 'convex/canvases/validation'
import type { CanvasDocumentNode as ParsedCanvasDocumentNode } from 'convex/canvases/validation'
import { logger } from '~/shared/utils/logger'

function buildSafePersistedCanvasNode(node: CanvasDocumentNode): ParsedCanvasDocumentNode {
  let type = parseCanvasNodeType(node.type) ?? 'text'
  let data = parseCanvasNodeDataByType(type, node.data)
  if (!data) {
    type = 'text'
    data = parseCanvasNodeDataByType(type, {}) ?? {}
  }
  const safeNode = {
    id: node.id,
    type,
    position: parseCanvasPoint2D(node.position) ?? { x: 0, y: 0 },
    data,
  } as ParsedCanvasDocumentNode

  const width = typeof node.width === 'number' && Number.isFinite(node.width) ? node.width : null
  if (width !== null) {
    safeNode.width = width
  }
  const height =
    typeof node.height === 'number' && Number.isFinite(node.height) ? node.height : null
  if (height !== null) {
    safeNode.height = height
  }
  if (typeof node.zIndex === 'number' && Number.isFinite(node.zIndex)) {
    safeNode.zIndex = node.zIndex
  }
  if (typeof node.className === 'string') {
    safeNode.className = node.className
  }
  if (typeof node.hidden === 'boolean') {
    safeNode.hidden = node.hidden
  }

  return safeNode
}

export function sanitizeNodeForPersistence(
  node: CanvasDocumentNode,
  operation: string,
  fallbackNode: CanvasDocumentNode = node,
): ParsedCanvasDocumentNode {
  try {
    const persistedNode = stripEphemeralCanvasNodeState(node)
    const parsedNode = parseCanvasDocumentNode(persistedNode)
    if (!parsedNode) {
      throw new TypeError('parseCanvasDocumentNode rejected the stripped canvas node shape')
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
