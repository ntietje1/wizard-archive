import { logger } from '~/shared/utils/logger'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

export function createCanvasNodesById(
  nodes: ReadonlyArray<CanvasDocumentNode>,
): ReadonlyMap<string, CanvasDocumentNode> {
  const nodesById = new Map<string, CanvasDocumentNode>()

  for (const [index, node] of nodes.entries()) {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string' || node.id.length === 0) {
      logger.warn(`createCanvasNodesById: skipping invalid node entry at index ${index}`)
      continue
    }

    if (nodesById.has(node.id)) {
      logger.warn(`createCanvasNodesById: duplicate node id "${node.id}", keeping last entry`)
    }

    nodesById.set(node.id, node)
  }

  return nodesById
}
