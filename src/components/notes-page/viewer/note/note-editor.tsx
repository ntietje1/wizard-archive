import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useCallback, useRef } from 'react'
import { BookOpen, Pencil } from 'lucide-react'
import { WikiLinkAutocomplete } from '../../editor/extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../editor/extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { Note, NoteWithContent } from 'convex/notes/types'
import type { CustomBlock, CustomBlockNoteEditor } from '~/lib/editor-schema'
import { openBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/contexts/BlockNoteContextMenuContext'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useNoteContent } from '~/hooks/useNoteContent'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { useScrollToHeading } from '~/hooks/useScrollToHeading'
import { useRestoreScrollPosition } from '~/hooks/useRestoreScrollPosition'
import { Button } from '~/components/shadcn/ui/button'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function NoteEditor({ item: note }: EditorViewerProps<Note>) {
  const { noteQuery, updateContent } = useNoteContent(note._id)

  if (noteQuery.isPending || !noteQuery.data) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    )
  }

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  return (
    <NoteEditorBase
      key={noteQuery.data._id}
      noteWithContent={noteQuery.data}
      updateContent={updateContent}
    />
  )
}

export const NoteEditorBase = ({
  noteWithContent,
  updateContent,
}: {
  noteWithContent: NoteWithContent
  updateContent: (newContent: Array<CustomBlock>) => void
}) => {
  const { editorMode } = useEditorMode()
  const initialContent =
    noteWithContent.content.length > 0 ? noteWithContent.content : undefined

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
  })

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)
  const { isScrollingToHeading } = useScrollToHeading(
    noteWithContent.content as Array<CustomBlock>,
    true,
    editor,
  )
  useRestoreScrollPosition(
    noteWithContent._id,
    scrollAreaRef,
    isScrollingToHeading,
  )

  const handleWrapperContextMenu = useCallback((e: React.MouseEvent) => {
    if (!e.isTrusted) return

    const target = e.target as HTMLElement
    if (target.closest('.bn-editor')) return

    e.preventDefault()
    e.stopPropagation()

    openBlockNoteContextMenu({
      position: { x: e.clientX, y: e.clientY },
      viewContext: 'note-view',
      item: undefined,
      blockId: undefined,
    })
  }, [])

  return (
    <BlockNoteContextMenuProvider editor={editor}>
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 h-full"
        contentClassName="h-full"
        onContextMenu={handleWrapperContextMenu}
      >
        <div className="absolute top-2 right-2 z-10">
          <EditorViewModeToggleButton />
        </div>
        <div className="note-editor-fill-height">
          <BlockNoteView
            className="mx-auto w-full max-w-3xl mt-4"
            key={noteWithContent._id + 'editor'}
            editor={editor}
            onChange={() => updateContent(editor.document)}
            theme="light"
            linkToolbar={false}
            sideMenu={false}
            formattingToolbar={false}
            slashMenu={false}
            editable={editorMode === 'editor'}
          >
            <BlockNoteContextMenuHandler />
            <WikiLinkAutocomplete editor={editor} />
            <WikiLinkClickHandler editor={editor} />
            <MdLinkClickHandler editor={editor} />
            <SideMenuController sideMenu={SideMenuRenderer} />
            <SlashMenu editor={editor} />
          </BlockNoteView>
        </div>
      </ScrollArea>
    </BlockNoteContextMenuProvider>
  )
}

export function EditorViewModeToggleButton() {
  const { editorMode, setEditorMode } = useEditorMode()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(editorMode === 'editor' ? 'viewer' : 'editor')
  }, [editorMode, setEditorMode])
  const label =
    editorMode === 'editor' ? 'Switch to viewer mode' : 'Switch to editor mode'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleEditorModeToggle}
      aria-label={label}
      title={label}
    >
      {editorMode === 'editor' ? (
        <Pencil className="h-4 w-4" />
      ) : (
        <BookOpen className="h-4 w-4" />
      )}
    </Button>
  )
}
