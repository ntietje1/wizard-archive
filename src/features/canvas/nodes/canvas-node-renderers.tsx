import { EmbedNode } from './embed/embed-node'
import { StrokeNode } from './stroke/stroke-node'
import { TextNode } from './text/text-node'

export const canvasNodeTypes = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const
