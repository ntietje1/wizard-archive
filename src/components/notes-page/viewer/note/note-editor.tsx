import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useBlockNoteSync } from '@convex-dev/prosemirror-sync/blocknote'
import { useCallback, useEffect, useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { editorSchema } from 'convex/notes/editorSpecs'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { WikiLinkAutocomplete } from '../../editor/extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../editor/extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import { openBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/contexts/BlockNoteContextMenuContext'
import { isNote } from '~/lib/sidebar-item-utils'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useFilteredNoteContent } from '~/hooks/useFilteredNoteContent'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { useScrollToHeading } from '~/hooks/useScrollToHeading'
import { useRestoreScrollPosition } from '~/hooks/useRestoreScrollPosition'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

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
        theme="light"
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
      >
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
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading…
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
  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)
  const { isScrollingToHeading } = useScrollToHeading(
    note.content,
    true,
    editor,
  )
  useRestoreScrollPosition(note._id, scrollAreaRef, isScrollingToHeading)

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
        className="flex-1 min-h-0"
        onContextMenu={handleWrapperContextMenu}
      >
        <div className="note-editor-fill-height">
          <BlockNoteView
            className="mx-auto w-full max-w-3xl mt-2"
            key={note._id + 'editor'}
            editor={editor}
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
