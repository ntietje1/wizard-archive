import { parseCanvasDocumentNode } from 'convex/canvases/validation'
import { normalizeEmbedNodeData } from './embed/embed-node-data'
import type { EmbedNodeData } from './embed/embed-node-data'
import { normalizeCanvasRichTextNodeData } from './shared/canvas-rich-text-node-data'
import type { CanvasRichTextNodeData } from './shared/canvas-rich-text-node-data'
import { normalizeStrokeNodeData } from './stroke/stroke-node-model'
import type { StrokeNodeData } from './stroke/stroke-node-model'
import type { CanvasRuntimeNode } from './canvas-node-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
import { assertNever } from '~/shared/utils/utils'

type CanvasNormalizedEmbedNode = CanvasRuntimeNode<'embed', EmbedNodeData>
type CanvasNormalizedStrokeNode = CanvasRuntimeNode<'stroke', StrokeNodeData>
type CanvasNormalizedTextNode = CanvasRuntimeNode<'text', CanvasRichTextNodeData>
export type AnyNormalizedCanvasNode =
  | CanvasNormalizedEmbedNode
  | CanvasNormalizedStrokeNode
  | CanvasNormalizedTextNode

function normalizeValidatedCanvasNode(node: CanvasDocumentNode): AnyNormalizedCanvasNode {
  switch (node.type) {
    case 'embed':
      return { ...node, data: normalizeEmbedNodeData(node.data) }
    case 'stroke':
      return { ...node, data: normalizeStrokeNodeData(node.data) }
    case 'text':
      return {
        ...node,
        data: normalizeCanvasRichTextNodeData(node.data),
      }
    default:
      return assertNever(node)
  }
}

export function normalizeCanvasNode(node: CanvasDocumentNode): AnyNormalizedCanvasNode | null {
  const parsedNode = parseCanvasDocumentNode(node)
  return parsedNode ? normalizeValidatedCanvasNode(parsedNode) : null
}
