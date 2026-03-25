import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useBlockNoteSync } from '@convex-dev/prosemirror-sync/blocknote'
import { useEffect, useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { editorSchema } from 'convex/notes/editorSpecs'
import SelectionToolbar from '../../extensions/selection-toolbar/selection-toolbar'
import { WikiLinkAutocomplete } from '../../extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { PreventExternalDrop } from '../../extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from '../../extensions/side-menu/side-menu'
import { SlashMenu } from '../../extensions/slash-menu/slash-menu'
import '../../extensions/wiki-link/wiki-link.css'
import '../../extensions/md-link/md-link.css'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { isNote } from '~/features/sidebar/utils/sidebar-item-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFilteredNoteContent } from '~/features/editor/hooks/useFilteredNoteContent'
import { useWikiLinkExtension } from '~/features/editor/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/features/editor/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useScrollToHeading } from '~/features/editor/hooks/useScrollToHeading'
import { useRestoreScrollPosition } from '~/features/editor/hooks/useRestoreScrollPosition'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { useNoteEditorDropTarget } from '~/features/dnd/hooks/useNoteEditorDropTarget'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'

export function NoteEditor({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { viewAsPlayerId } = useEditorMode()
  const { content: filteredContent, isViewOnly } = useFilteredNoteContent(note)

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  if (isViewOnly) {
    return (
      <ClientOnly fallback={null}>
        <ReadOnlyNote
          key={note._id + '-' + viewAsPlayerId}
          content={filteredContent}
          noteId={note._id}
        />
      </ClientOnly>
    )
  }

  return (
    <ClientOnly fallback={null}>
      <CollaborativeNote key={note._id} note={note} />
    </ClientOnly>
  )
}

// ---------------------------------------------------------------------------
// Read-only viewer – standalone BlockNote editor fed with filtered content
// ---------------------------------------------------------------------------

const ReadOnlyNote = ({
  content,
  noteId,
}: {
  content: Array<CustomBlock>
  noteId: Id<'notes'>
}) => {
  const resolvedTheme = useResolvedTheme()
  const initialContent = content.length > 0 ? content : undefined

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
  })

  useEffect(() => {
    editor.replaceBlocks(editor.document, content)
  }, [editor, content])

  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)

  return (
    <ScrollArea className="flex-1 min-h-0">
      <BlockNoteView
        className="mx-auto w-full max-w-3xl mt-2"
        key={noteId + 'viewer'}
        editable={false}
        editor={editor}
        theme={resolvedTheme}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
      >
        <PreventExternalDrop />
        <WikiLinkClickHandler editor={editor} />
        <MdLinkClickHandler editor={editor} />
        <SideMenuController sideMenu={SideMenuRenderer} />
        <SelectionToolbar />
        <SlashMenu editor={editor} />
      </BlockNoteView>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Collaborative editor – prosemirror-sync powered
// ---------------------------------------------------------------------------

const CollaborativeNote = ({ note }: { note: NoteWithContent }) => {
  const { editorMode } = useEditorMode()

  const sync = useBlockNoteSync<CustomBlockNoteEditor>(
    api.prosemirrorSync,
    note._id,
    { editorOptions: { schema: editorSchema } },
  )

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  if (!sync.editor) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <CollaborativeNoteReady
      editor={sync.editor}
      note={note}
      editorMode={editorMode}
      scrollAreaRef={scrollAreaRef}
    />
  )
}

const CollaborativeNoteReady = ({
  editor,
  note,
  editorMode,
  scrollAreaRef,
}: {
  editor: CustomBlockNoteEditor
  note: NoteWithContent
  editorMode: string
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
}) => {
  const resolvedTheme = useResolvedTheme()
  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)
  const { isScrollingToHeading } = useScrollToHeading(
    note.content,
    true,
    editor,
  )
  useRestoreScrollPosition(note._id, scrollAreaRef, isScrollingToHeading)

  const editorDropRef = useRef<HTMLDivElement>(null)
  useNoteEditorDropTarget({ ref: editorDropRef, editor, noteId: note._id })

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
      blockId: undefined,
    })
  }

  return (
    <BlockNoteContextMenuProvider editor={editor}>
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 min-h-0"
        onContextMenu={handleWrapperContextMenu}
      >
        <div className="note-editor-fill-height">
          <div ref={editorDropRef} className="mx-auto w-full max-w-3xl mt-2">
            <BlockNoteView
              key={note._id + 'editor'}
              editor={editor}
              theme={resolvedTheme}
              linkToolbar={false}
              sideMenu={false}
              formattingToolbar={false}
              slashMenu={false}
              editable={editorMode === 'editor'}
            >
              <PreventExternalDrop />
              <BlockNoteContextMenuHandler />
              <WikiLinkAutocomplete editor={editor} />
              <WikiLinkClickHandler editor={editor} />
              <MdLinkClickHandler editor={editor} />
              <SideMenuController sideMenu={SideMenuRenderer} />
              <SlashMenu editor={editor} />
            </BlockNoteView>
          </div>
        </div>
      </ScrollArea>
    </BlockNoteContextMenuProvider>
  )
}
