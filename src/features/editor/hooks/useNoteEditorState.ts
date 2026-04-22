import { useCallback, useEffect, useRef, useState } from 'react'
import { useNoteEditorDropTarget } from '~/features/dnd/hooks/useNoteEditorDropTarget'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'

const BLOCKNOTE_EDITOR_SELECTOR = '.bn-editor'

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

  useYjsPreviewUpload({
    itemId: noteId,
    doc,
    containerRef: wrapperRef,
    resolveElement: (container) => {
      const element = container.querySelector(BLOCKNOTE_EDITOR_SELECTOR)
      return element instanceof HTMLElement ? element : null
    },
  })
  useNoteEditorDropTarget({ ref: wrapperRef, noteId })

  return { onEditorChange, wrapperRef }
}
