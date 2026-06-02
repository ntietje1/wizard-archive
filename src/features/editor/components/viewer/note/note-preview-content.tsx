import type { NoteWithContent } from 'shared/notes/types'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function NotePreviewContent({ note }: { note: NoteWithContent }) {
  return (
    <ScrollArea className="h-full">
      <div className="pointer-events-none text-sm">
        <NoteContent note={note} editable={false} />
      </div>
    </ScrollArea>
  )
}
