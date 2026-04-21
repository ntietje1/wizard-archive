import { useEffect, useRef, useState } from 'react'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { Doc } from 'yjs'
import type { RichEmbedLifecycleController } from './use-rich-embed-lifecycle'
import { useNoteEmbedLifecycle } from './use-note-embed-lifecycle'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

export function EmbedNoteContent({
  noteId,
  content,
  editable,
  isExclusivelySelected,
  lifecycle,
  onCanvasEditorChange,
}: {
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
  editable: boolean
  isExclusivelySelected: boolean
  lifecycle: RichEmbedLifecycleController
  onCanvasEditorChange?: (editor: CustomBlockNoteEditor | null) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)

  const onEditorChange = (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
    setEditor(newEditor)
    setDoc(newDoc)
    onCanvasEditorChange?.(newEditor)
  }

  useNoteEmbedLifecycle({
    lifecycle,
    editor,
    editable,
    doc,
  })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || scrollTopRef.current <= 0) return

    const raf = requestAnimationFrame(() => {
      viewport.scrollTop = scrollTopRef.current
    })

    return () => cancelAnimationFrame(raf)
  }, [doc, editable, editor])

  return (
    <div className={cn('h-full', editable && 'nodrag nopan', isExclusivelySelected && 'nowheel')}>
      <ScrollArea viewportRef={viewportRef} className="h-full">
        <NoteContent
          noteId={noteId}
          content={content}
          editable={editable}
          onEditorChange={onEditorChange}
        />
      </ScrollArea>
    </div>
  )
}
