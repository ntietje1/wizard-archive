import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { CanvasRichTextPreview } from '../nodes/shared/canvas-rich-text-node'
import { normalizeCanvasRichTextNodeData } from '../nodes/shared/canvas-rich-text-node-data'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { CanvasRichTextNodeInputData } from '../nodes/shared/canvas-rich-text-node-data'

export function CanvasPreviewTextNode({
  data,
  dragging,
}: CanvasNodeComponentProps<CanvasRichTextNodeInputData>) {
  const normalizedData = normalizeCanvasRichTextNodeData(data)
  const invalid = normalizedData.richText.kind === 'invalid'

  return (
    <CanvasPreviewNodeFrame nodeType="text" dragging={!!dragging}>
      <CanvasRichTextPreview
        content={normalizedData.richText.content}
        data={normalizedData}
        invalid={invalid}
        variant={{
          containerClassName: 'min-h-[30px] min-w-[80px] rounded-lg',
          contentClassName: 'h-full w-full overflow-hidden pt-2',
          invalidContentLabel: 'Invalid text content',
          textClassName: 'text-sm',
        }}
      />
    </CanvasPreviewNodeFrame>
  )
}
