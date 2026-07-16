import type { CSSProperties } from 'react'
import type { CanvasTextDocument } from './text/model'
import { renderCommonRichTextBlocks } from '../rich-text/blocknote/static-preview'

export function CanvasTextPreview({
  content,
  selected,
  style,
}: {
  content: CanvasTextDocument | undefined
  selected: boolean
  style: CSSProperties
}) {
  return (
    <div
      className={`size-full overflow-hidden whitespace-pre-wrap rounded-md border bg-card p-2 text-sm shadow-sm ${selected ? 'ring-2 ring-ring' : ''}`}
      style={style}
    >
      {content?.length ? (
        renderCommonRichTextBlocks(content)
      ) : (
        <span className="text-muted-foreground">Double-click to edit</span>
      )}
    </div>
  )
}
