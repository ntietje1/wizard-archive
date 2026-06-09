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
      className="canvas-rich-text-editor h-full"
      data-embedded-note-mode="readonly"
      data-testid="embed-note-content-wrapper"
    >
      <ScrollArea
        className="h-full"
        contentClassName="note-editor-scroll-content embedded-note-block-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={!allowInnerScroll ? { overflowY: 'hidden' } : undefined}
      >
        <RawNoteContent noteId={note._id} content={note.content} editable={false} fillHeight />
      </ScrollArea>
    </div>
  )
}
