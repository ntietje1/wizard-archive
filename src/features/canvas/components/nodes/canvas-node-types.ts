import { TextNode } from './text-node'
import { StickyNode } from './sticky-node'
import { RectangleNode } from './rectangle-node'
import { StrokeNode } from './stroke-node'
import type { NodeTypes } from '@xyflow/react'

export const canvasNodeTypes: NodeTypes = {
  text: TextNode,
  sticky: StickyNode,
  rectangle: RectangleNode,
  stroke: StrokeNode,
}
