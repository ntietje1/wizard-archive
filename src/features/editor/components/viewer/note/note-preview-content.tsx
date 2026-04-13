import type { CustomBlock } from 'convex/notes/editorSpecs'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function NotePreviewContent({ content }: { content: Array<CustomBlock> }) {
  return (
    <ScrollArea className="h-full">
      <div className="pointer-events-none text-sm">
        <NoteContent content={content} editable={false} />
      </div>
    </ScrollArea>
  )
}
