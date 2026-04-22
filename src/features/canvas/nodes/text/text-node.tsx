import type { Node, NodeProps } from '@xyflow/react'
import { CanvasRichTextNode } from '../shared/canvas-rich-text-node'
import type { CanvasRichTextNodeData } from '../shared/canvas-rich-text-node'

export type TextNodeData = CanvasRichTextNodeData

export function TextNode(props: NodeProps<Node<TextNodeData>>) {
  return (
    <CanvasRichTextNode
      {...props}
      variant={{
        nodeType: 'text',
        editAriaLabel: 'Text node content',
        emptyAriaLabel: 'Empty text node',
        minWidth: 80,
        minHeight: 30,
        containerClassName: 'rounded-lg shadow-sm',
        contentClassName: 'h-full w-full overflow-hidden',
        textClassName: 'text-sm',
        textColor: 'inherit',
      }}
    />
  )
}
