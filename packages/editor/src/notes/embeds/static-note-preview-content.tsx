import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { ReadonlyNoteBlocksSurface } from '../readonly-note-blocks-surface'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { EmbeddedNoteContentSource } from '../runtime'

export function StaticNotePreviewContent({
  allowInnerScroll,
  constrained,
  fillAvailableHeight,
  embeddedNoteContentSource,
  note,
}: {
  allowInnerScroll: boolean
  constrained: boolean
  fillAvailableHeight: boolean
  embeddedNoteContentSource: EmbeddedNoteContentSource
  note: NoteItemWithContent
}) {
  const maxPreviewHeight = constrained ? 'min(480px, 70vh)' : undefined
  const content = embeddedNoteContentSource.getEmbeddedNoteContent?.(note) ?? note.content

  return (
    <div
      className={cn('h-full', constrained && 'overflow-hidden')}
      style={maxPreviewHeight ? { maxHeight: maxPreviewHeight } : undefined}
    >
      <ScrollArea
        className="h-full"
        contentClassName="note-editor-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={maxPreviewHeight ? { maxHeight: maxPreviewHeight } : undefined}
      >
        <ReadonlyNoteBlocksSurface
          content={content}
          embeddedNoteContentSource={embeddedNoteContentSource}
          fillHeight={fillAvailableHeight}
          note={note}
        />
      </ScrollArea>
    </div>
  )
}
