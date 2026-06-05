import { logger } from '~/shared/utils/logger'
import { normalizeCanvasDocumentNode } from '~/features/canvas/domain/canvas-document'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

function getCanvasDocumentNodeLogField(node: unknown, field: 'id' | 'type') {
  if (!node || typeof node !== 'object' || !(field in node)) {
    return undefined
  }
  return (node as Record<'id' | 'type', unknown>)[field]
}

export function sanitizeNodeForPersistence(
  node: CanvasDocumentNode,
  operation: string,
): CanvasDocumentNode {
  const parsedNode = normalizeCanvasDocumentNode(node)
  if (parsedNode) {
    return parsedNode
  }

  const error = new TypeError('Invalid canvas document node rejected at persistence boundary')
  logger.error('Canvas node persistence rejected invalid document node', {
    operation,
    nodeId: getCanvasDocumentNodeLogField(node, 'id'),
    nodeType: getCanvasDocumentNodeLogField(node, 'type'),
    error,
  })
  throw error
}
