import { normalizeCanvasDocumentNode } from '../../document-contract'
import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import type { CanvasDocumentNode } from '../../document-contract'

export function createCanvasNodesById(
  nodes: ReadonlyArray<unknown>,
): ReadonlyMap<string, CanvasDocumentNode> {
  const nodesById = new Map<string, CanvasDocumentNode>()

  for (const [index, node] of nodes.entries()) {
    const normalizedNode = normalizeCanvasDocumentNode(node)
    if (!normalizedNode || !getCanvasNodeBounds(normalizedNode)) {
      console.warn(`createCanvasNodesById: skipping invalid node entry at index ${index}`)
      continue
    }

    if (nodesById.has(normalizedNode.id)) {
      console.warn(
        `createCanvasNodesById: duplicate node id "${normalizedNode.id}", keeping last entry`,
      )
    }

    nodesById.set(normalizedNode.id, normalizedNode)
  }

  return nodesById
}
