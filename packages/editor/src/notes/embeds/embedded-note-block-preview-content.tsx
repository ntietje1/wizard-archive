import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { ReadonlyNoteBlocksSurface } from '../readonly-note-blocks-surface'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { EmbeddedNoteContentSource } from '../runtime'

export function EmbeddedNoteBlockPreviewContent({
  allowInnerScroll = false,
  embeddedNoteContentSource,
  note,
}: {
  allowInnerScroll?: boolean
  embeddedNoteContentSource: EmbeddedNoteContentSource
  note: NoteItemWithContent
}) {
  const content = embeddedNoteContentSource.getEmbeddedNoteContent?.(note) ?? note.content

  return (
    <div
      className="note-editor-surface h-full"
      data-embedded-note-mode="readonly"
      data-testid="embed-note-content-wrapper"
    >
      <ScrollArea
        className="h-full"
        contentClassName="note-editor-scroll-content embedded-note-block-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
      >
        <ReadonlyNoteBlocksSurface
          note={note}
          content={content}
          embeddedNoteContentSource={embeddedNoteContentSource}
          fillHeight
        />
      </ScrollArea>
    </div>
  )
}
