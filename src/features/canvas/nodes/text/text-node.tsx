import { CanvasRichTextNode } from '../shared/canvas-rich-text-node'
import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'
import { normalizeCanvasRichTextNodeData } from '../shared/canvas-rich-text-node-data'
import type { CanvasRichTextNodeInputData } from '../shared/canvas-rich-text-node-data'
import type { CanvasNodeComponentProps } from '../canvas-node-types'

export function TextNode(props: CanvasNodeComponentProps<CanvasRichTextNodeInputData>) {
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
        minWidth: CANVAS_NODE_MIN_SIZE,
        minHeight: CANVAS_NODE_MIN_SIZE,
        containerClassName: 'rounded-lg',
        contentClassName: 'h-full w-full overflow-hidden',
        textClassName: 'text-sm',
      }}
    />
  )
}
