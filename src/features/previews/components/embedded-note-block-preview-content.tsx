import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import type { NoteWithContent } from 'shared/notes/types'

export function EmbeddedNoteBlockPreviewContent({
  note,
  allowInnerScroll = false,
}: {
  note: NoteWithContent
  allowInnerScroll?: boolean
}) {
  return (
    <div
      className="canvas-rich-text-editor h-full pt-2"
      data-embedded-note-mode="readonly"
      data-note-block-embed-preview="true"
      data-testid="embed-note-content-wrapper"
    >
      <ScrollArea
        className="h-full"
        contentClassName="note-editor-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={!allowInnerScroll ? { overflowY: 'hidden' } : undefined}
      >
        <RawNoteContent noteId={note._id} content={note.content} editable={false} fillHeight />
      </ScrollArea>
    </div>
  )
}
