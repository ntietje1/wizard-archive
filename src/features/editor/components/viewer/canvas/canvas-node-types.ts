import { TextNode } from './nodes/text-node'
import { StickyNode } from './nodes/sticky-node'
import type { NodeTypes } from '@xyflow/react'

export const canvasNodeTypes: NodeTypes = {
  text: TextNode,
  sticky: StickyNode,
}
