import { useEffect, useRef } from 'react'
import type { NoteBlock } from '../document/model'
import { useScopedNoteEditorStore } from '../editor-store'
import type { NoteScrollRequest } from '../runtime'
import { findNoteBlockElementInEditor } from './dom'
import { extractHeadingsFromContent, resolveHeadingPath } from './heading-utils'

interface NoteHeadingScrollRequestInput {
  content: Array<NoteBlock> | undefined
  heading: string | null | undefined
  onConsumed?: () => void
}

export function useNoteHeadingScrollRequest({
  content,
  heading,
  onConsumed,
}: NoteHeadingScrollRequestInput): NoteScrollRequest {
  const editor = useScopedNoteEditorStore((s) => s.editor)
  const lastScrolledRef = useRef<string | null>(null)
  const onConsumedRef = useRef(onConsumed)
  onConsumedRef.current = onConsumed

  useEffect(() => {
    if (!heading || !content) {
      if (!heading) lastScrolledRef.current = null
      return
    }
    if (lastScrolledRef.current === heading) return

    const headingPath = heading.split('#').filter(Boolean)
    if (headingPath.length === 0) {
      lastScrolledRef.current = heading
      onConsumedRef.current?.()
      return
    }

    const target = resolveHeadingPath(extractHeadingsFromContent(content), headingPath)
    if (!target) {
      lastScrolledRef.current = heading
      onConsumedRef.current?.()
      return
    }

    lastScrolledRef.current = heading

    let focusFrameId: number | null = null
    const scrollFrameId = requestAnimationFrame(() => {
      findNoteBlockElementInEditor(editor, target.noteBlockId)?.scrollIntoView({ block: 'start' })

      onConsumedRef.current?.()

      focusFrameId = requestAnimationFrame(() => {
        if (!editor?._tiptapEditor?.view) return
        try {
          editor.focus()
          editor.setTextCursorPosition(target.noteBlockId, 'end')
        } catch {
          // Block might not exist yet or position out of range.
        }
      })
    })

    return () => {
      cancelAnimationFrame(scrollFrameId)
      if (focusFrameId !== null) cancelAnimationFrame(focusFrameId)
    }
  }, [heading, content, editor])

  return heading ? { status: 'requested' } : { status: 'none' }
}
