import { useCallback, useEffect, useRef, useState } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
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
  noteId: Id<'notes'>
  content: Array<CustomBlock>
  editable: boolean
  selected: boolean
  scrollTopRef: React.MutableRefObject<number>
  clickCoordsRef: React.MutableRefObject<{ x: number; y: number } | null>
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

  useEffect(() => {
    if (!editor || !editable || !doc) return

    const rafId = requestAnimationFrame(() => {
      const view = editor._tiptapEditor?.view
      if (!view?.dom?.isConnected) return

      const coords = clickCoordsRef.current

      if (coords) {
        const pos = view.posAtCoords({ left: coords.x, top: coords.y })
        if (pos) {
          const tr = view.state.tr.setSelection(
            TextSelection.create(view.state.doc, pos.pos),
          )
          view.dispatch(tr)
        }
        clickCoordsRef.current = null
      }

      view.focus()
    })

    return () => cancelAnimationFrame(rafId)
  }, [editor, editable, doc, clickCoordsRef])

  return (
    <div
      className={cn(
        'h-full',
        editable && 'nodrag nopan',
        selected && 'nowheel',
      )}
    >
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
