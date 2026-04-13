import { useCallback, useEffect, useRef, useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { EDITOR_MODE } from 'convex/editors/types'
import { BlockNoteContextMenuHandler } from '../../extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { NoteContent } from '../../note-content'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import { useNotePreview } from '~/features/previews/hooks/use-note-preview'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { isNote } from '~/features/sidebar/utils/sidebar-item-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFilteredNoteContent } from '~/features/editor/hooks/useFilteredNoteContent'
import { useScrollToHeading } from '~/features/editor/hooks/useScrollToHeading'
import { useRestoreScrollPosition } from '~/features/editor/hooks/useRestoreScrollPosition'
import { useNoteEditorDropTarget } from '~/features/dnd/hooks/useNoteEditorDropTarget'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function NoteEditor({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { editorMode, canEdit } = useEditorMode()
  const { content: filteredContent, isViewOnly } = useFilteredNoteContent(note)

  const editable = !isViewOnly && editorMode === EDITOR_MODE.EDITOR && canEdit

  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)

  const onEditorChange = useCallback(
    (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
      setEditor(newEditor)
      setDoc(newDoc)
    },
    [],
  )

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const noteEditorRef = useRef<HTMLElement | null>(null)

  const { isScrollingToHeading } = useScrollToHeading(note.content, true, editor ?? undefined)
  useRestoreScrollPosition(note._id, scrollAreaRef, isScrollingToHeading)

  useEffect(() => {
    noteEditorRef.current = wrapperRef.current?.querySelector('.bn-editor') as HTMLElement | null
  }, [editor])

  useNotePreview({ noteId: note._id, doc, editorContainerRef: noteEditorRef })
  useNoteEditorDropTarget({ ref: wrapperRef, editor, noteId: note._id })

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  const handleWrapperContextMenu = (e: React.MouseEvent) => {
    if (!e.isTrusted) return

    const target = e.target as HTMLElement
    if (target.closest('.bn-editor')) return

    e.preventDefault()
    e.stopPropagation()

    openBlockNoteContextMenu({
      position: { x: e.clientX, y: e.clientY },
      viewContext: 'note-view',
      item: undefined,
      blockNoteId: undefined,
    })
  }

  return (
    <ClientOnly fallback={null}>
      <BlockNoteContextMenuProvider editor={editor}>
        <div
          ref={wrapperRef}
          className="flex flex-col flex-1 min-h-0"
          onContextMenu={handleWrapperContextMenu}
        >
          <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
            <NoteContent
              key={note._id}
              noteId={note._id}
              content={filteredContent}
              editable={editable}
              onEditorChange={onEditorChange}
              className="mx-auto w-full max-w-3xl mt-2"
            >
              <BlockNoteContextMenuHandler />
            </NoteContent>
          </ScrollArea>
        </div>
      </BlockNoteContextMenuProvider>
    </ClientOnly>
  )
}
