import { logger } from '~/shared/utils/logger'
import type { Node } from '@xyflow/react'

export function createCanvasNodesById(nodes: Array<Node>): ReadonlyMap<string, Node> {
  const nodesById = new Map<string, Node>()

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string' || node.id.length === 0) {
      logger.warn('createCanvasNodesById: skipping invalid node entry')
      continue
    }

    if (nodesById.has(node.id)) {
      logger.warn(`createCanvasNodesById: duplicate node id "${node.id}", keeping last entry`)
    }

    nodesById.set(node.id, node)
  }

  return nodesById
}
