import type { NodeTypes } from '@xyflow/react'
import { EmbeddedCanvasPreviewNode } from './embedded-canvas-preview-node'
import { StrokeNode } from '../stroke/stroke-node'
import { TextNode } from '../text/text-node'

const embeddedCanvasNodeTypes = {
  embed: EmbeddedCanvasPreviewNode,
  stroke: StrokeNode,
  text: TextNode,
} as const satisfies NodeTypes

export function getEmbeddedCanvasNodeTypes(): typeof embeddedCanvasNodeTypes {
  return embeddedCanvasNodeTypes
}
