import type { Node, NodeProps } from '@xyflow/react'
import { CanvasRichTextNode } from '../shared/canvas-rich-text-node'
import { normalizeCanvasRichTextNodeData } from '../shared/canvas-rich-text-node-data'
import type { CanvasRichTextNodeInputData } from '../shared/canvas-rich-text-node-data'

export function TextNode(props: NodeProps<Node<CanvasRichTextNodeInputData>>) {
  return (
    <CanvasRichTextNode
      {...props}
      data={normalizeCanvasRichTextNodeData(props.data)}
      variant={{
        nodeType: 'text',
        editAriaLabel: 'Text node content',
        emptyAriaLabel: 'Empty text node',
        invalidAriaLabel: 'Invalid text node content',
        invalidContentLabel: 'Invalid text content',
        minWidth: 80,
        minHeight: 30,
        containerClassName: 'rounded-lg',
        contentClassName: 'h-full w-full overflow-hidden',
        textClassName: 'text-sm',
        textColor: 'inherit',
      }}
    />
  )
}
