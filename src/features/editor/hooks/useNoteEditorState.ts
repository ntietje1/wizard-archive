import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotePreview } from '~/features/previews/hooks/use-note-preview'
import { useNoteEditorDropTarget } from '~/features/dnd/hooks/useNoteEditorDropTarget'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'

export function useNoteEditorState(noteId: Id<'sidebarItems'>) {
  const [doc, setDoc] = useState<Doc | null>(null)

  const claimEditor = useNoteEditorStore((s) => s.claimEditor)
  const releaseEditorRef = useRef<(() => void) | null>(null)

  const onEditorChange = useCallback(
    (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
      releaseEditorRef.current?.()
      releaseEditorRef.current = claimEditor(newEditor)
      setDoc(newDoc)
    },
    [claimEditor],
  )

  useEffect(() => {
    return () => {
      releaseEditorRef.current?.()
      setDoc(null)
    }
  }, [noteId])

  const wrapperRef = useRef<HTMLDivElement>(null)

  useNotePreview({ noteId, doc, containerRef: wrapperRef })
  useNoteEditorDropTarget({ ref: wrapperRef, noteId })

  return { onEditorChange, wrapperRef }
}
