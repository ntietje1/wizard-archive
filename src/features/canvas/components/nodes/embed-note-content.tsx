import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { Doc } from 'yjs'
import { useEmbedNoteFocusSync } from '../../hooks/useEmbedNoteFocusSync'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

export function EmbedNoteContent({
  noteId,
  content,
  editable,
  selected,
  scrollTopRef,
  clickCoordsRef,
}: {
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
  editable: boolean
  selected: boolean
  scrollTopRef: React.RefObject<number>
  clickCoordsRef: React.RefObject<{ x: number; y: number } | null>
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)

  const onEditorChange = useCallback(
    (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
      setEditor(newEditor)
      setDoc(newDoc)
    },
    [],
  )

  useEmbedNoteFocusSync({
    editor,
    editable,
    doc,
    clickCoordsRef,
  })

  useEffect(() => {
    const el = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null
    if (!el) return

    const onScroll = () => {
      scrollTopRef.current = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    if (scrollTopRef.current > 0) {
      const raf = requestAnimationFrame(() => {
        el.scrollTop = scrollTopRef.current
      })
      return () => {
        cancelAnimationFrame(raf)
        el.removeEventListener('scroll', onScroll)
      }
    }

    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [editor, editable, scrollTopRef])

  return (
    <div className={cn('h-full', editable && 'nodrag nopan', selected && 'nowheel')}>
      <ScrollArea ref={scrollAreaRef} className="h-full">
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
