import { TextNode } from './nodes/text-node'
import { StickyNode } from './nodes/sticky-node'
import { RectangleNode } from './nodes/rectangle-node'
import { StrokeNode } from './nodes/stroke-node'
import type { NodeTypes } from '@xyflow/react'

export const canvasNodeTypes: NodeTypes = {
  text: TextNode,
  sticky: StickyNode,
  rectangle: RectangleNode,
  stroke: StrokeNode,
}
