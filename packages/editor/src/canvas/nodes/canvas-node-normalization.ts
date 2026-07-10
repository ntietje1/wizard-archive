import { normalizeEmbedNodeData } from '../embed-node-model'
import type { EmbedNodeData } from '../embed-node-model'
import { normalizeCanvasTextNodeRenderData } from '../text/node-data'
import type { CanvasTextNodeRenderData } from '../text/node-data'
import { normalizeStrokeNodeData } from './stroke/stroke-node-model'
import type { StrokeNodeData } from './stroke/stroke-node-model'
import type { CanvasRuntimeNode } from './canvas-node-types'
import { normalizeCanvasDocumentNode } from '../document-contract'
import type { CanvasDocumentNode } from '../document-contract'

type CanvasNormalizedEmbedNode = CanvasRuntimeNode<'embed', EmbedNodeData>
type CanvasNormalizedStrokeNode = CanvasRuntimeNode<'stroke', StrokeNodeData>
type CanvasNormalizedTextNode = CanvasRuntimeNode<'text', CanvasTextNodeRenderData>
export type AnyNormalizedCanvasNode =
  | CanvasNormalizedEmbedNode
  | CanvasNormalizedStrokeNode
  | CanvasNormalizedTextNode

function assertNever(value: never): never {
  throw new Error(`Unhandled canvas node type: ${JSON.stringify(value)}`)
}

function normalizeValidatedCanvasNode(node: CanvasDocumentNode): AnyNormalizedCanvasNode {
  switch (node.type) {
    case 'embed':
      return { ...node, data: normalizeEmbedNodeData(node.data) }
    case 'stroke':
      return { ...node, data: normalizeStrokeNodeData(node.data) }
    case 'text':
      return {
        ...node,
        data: normalizeCanvasTextNodeRenderData(node.data),
      }
    default:
      return assertNever(node)
  }
}

export function normalizeCanvasNode(node: CanvasDocumentNode): AnyNormalizedCanvasNode | null {
  const parsedNode = normalizeCanvasDocumentNode(node)
  return parsedNode ? normalizeValidatedCanvasNode(parsedNode) : null
}
