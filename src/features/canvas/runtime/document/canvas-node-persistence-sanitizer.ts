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
  const safeNodeFields: Partial<ParsedCanvasDocumentNode> = {}
  const safeNodeBase = {
    id: node.id,
    type,
    position: parseCanvasPoint2D(node.position) ?? { x: 0, y: 0 },
    data,
  }

  const width = typeof node.width === 'number' && Number.isFinite(node.width) ? node.width : null
  if (width !== null) {
    safeNodeFields.width = width
  }
  const height =
    typeof node.height === 'number' && Number.isFinite(node.height) ? node.height : null
  if (height !== null) {
    safeNodeFields.height = height
  }
  if (typeof node.zIndex === 'number' && Number.isFinite(node.zIndex)) {
    safeNodeFields.zIndex = node.zIndex
  }
  if (typeof node.className === 'string') {
    safeNodeFields.className = node.className
  }
  if (typeof node.hidden === 'boolean') {
    safeNodeFields.hidden = node.hidden
  }

  return { ...safeNodeBase, ...safeNodeFields } as ParsedCanvasDocumentNode
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
