import { parseCanvasRuntimeNode } from 'convex/canvases/validation'
import { normalizeEmbedNodeData } from './embed/embed-node-data'
import type { EmbedNodeData } from './embed/embed-node-data'
import { normalizeCanvasRichTextNodeData } from './shared/canvas-rich-text-node-data'
import type { CanvasRichTextNodeData } from './shared/canvas-rich-text-node-data'
import { normalizeStrokeNodeData } from './stroke/stroke-node-model'
import type { StrokeNodeData } from './stroke/stroke-node-model'
import type { CanvasRuntimeNode } from './canvas-node-types'
import type { ParsedCanvasRuntimeNode } from 'convex/canvases/validation'
import type { Node } from '@xyflow/react'
import { assertNever } from '~/shared/utils/utils'

type CanvasNormalizedEmbedNode = CanvasRuntimeNode<EmbedNodeData, 'embed'>
type CanvasNormalizedStrokeNode = CanvasRuntimeNode<StrokeNodeData, 'stroke'>
type CanvasNormalizedTextNode = CanvasRuntimeNode<CanvasRichTextNodeData, 'text'>
export type AnyNormalizedCanvasNode =
  | CanvasNormalizedEmbedNode
  | CanvasNormalizedStrokeNode
  | CanvasNormalizedTextNode

function normalizeParsedCanvasNode(node: ParsedCanvasRuntimeNode): AnyNormalizedCanvasNode {
  switch (node.type) {
    case 'embed':
      return { ...node, data: normalizeEmbedNodeData(node.data) }
    case 'stroke':
      return { ...node, data: normalizeStrokeNodeData(node.data) }
    case 'text':
      return { ...node, data: normalizeCanvasRichTextNodeData(node.data) }
    default:
      return assertNever(node)
  }
}

export function normalizeCanvasNode(node: Node): AnyNormalizedCanvasNode | null {
  const parsedNode = parseCanvasRuntimeNode(node)
  return parsedNode ? normalizeParsedCanvasNode(parsedNode) : null
}
