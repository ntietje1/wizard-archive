import { EmbedNode } from './embed-node'
import { RectangleNode } from './rectangle-node'
import { StickyNode } from './sticky-node'
import { StrokeNode } from './stroke-node'
import { TextNode } from './text-node'
import type { NodeTypes } from '@xyflow/react'

export const canvasNodeTypes: NodeTypes = {
  embed: EmbedNode,
  rectangle: RectangleNode,
  sticky: StickyNode,
  stroke: StrokeNode,
  text: TextNode,
}
