import { useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { EDITOR_MODE } from 'convex/editors/types'
import { BlockNoteContextMenuHandler } from '../../extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { NoteContent } from '../../note-content'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { isNote } from '~/features/sidebar/utils/sidebar-item-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFilteredNoteContent } from '~/features/editor/hooks/useFilteredNoteContent'
import { useNoteEditorState } from '~/features/editor/hooks/useNoteEditorState'
import { useScrollPersistence } from '~/features/editor/hooks/useScrollPersistence'
import { useScrollToHeading } from '~/features/editor/hooks/useScrollToHeading'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function NoteEditor({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { editorMode, canEdit } = useEditorMode()
  const { content: filteredContent, isViewOnly } = useFilteredNoteContent(note)

  const editable = !isViewOnly && editorMode === EDITOR_MODE.EDITOR && canEdit

  const { onEditorChange, wrapperRef } = useNoteEditorState(note._id)
  const viewportRef = useRef<HTMLDivElement>(null)
  const { hasHeadingParam } = useScrollToHeading(note.content)
  useScrollPersistence(note._id, viewportRef, hasHeadingParam)

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
      <BlockNoteContextMenuProvider>
        <div
          ref={wrapperRef}
          className="flex flex-col flex-1 min-h-0"
          data-testid="note-editor-wrapper"
          onContextMenu={handleWrapperContextMenu}
        >
          <ScrollArea
            viewportRef={viewportRef}
            className="flex-1 min-h-0"
            contentClassName={editable ? 'note-editor-scroll-content' : undefined}
          >
            <NoteContent
              key={note._id}
              noteId={note._id}
              content={filteredContent}
              editable={editable}
              onEditorChange={onEditorChange}
              className="note-editor-surface"
            >
              <BlockNoteContextMenuHandler />
            </NoteContent>
          </ScrollArea>
        </div>
      </BlockNoteContextMenuProvider>
    </ClientOnly>
  )
}
