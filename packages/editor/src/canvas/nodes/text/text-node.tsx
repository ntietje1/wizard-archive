import { CanvasTextNode } from '../shared/canvas-text-node'
import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'
import { normalizeCanvasTextNodeRenderData } from '../../text/node-data'
import type { CanvasNodeComponentProps } from '../canvas-node-types'

export function TextNode(props: CanvasNodeComponentProps<'text'>) {
  return (
    <CanvasTextNode
      {...props}
      data={normalizeCanvasTextNodeRenderData(props.data)}
      variant={{
        nodeType: 'text',
        editAriaLabel: 'Text node content',
        emptyAriaLabel: 'Empty text node',
        invalidAriaLabel: 'Invalid text node content',
        invalidContentLabel: 'Invalid text content',
        minWidth: CANVAS_NODE_MIN_SIZE,
        minHeight: CANVAS_NODE_MIN_SIZE,
        containerClassName: 'rounded-lg',
        contentClassName: 'h-full w-full overflow-hidden pt-2',
        textClassName: 'text-sm',
      }}
    />
  )
}
