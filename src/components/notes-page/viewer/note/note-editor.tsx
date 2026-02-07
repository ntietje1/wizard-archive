import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { useBlockNoteSync } from '@convex-dev/prosemirror-sync/blocknote'
import { useCallback, useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { editorSchema } from 'convex/notes/editorSpecs'
import { WikiLinkAutocomplete } from '../../editor/extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../editor/extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import { NoteViewer } from './note-viewer'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { openBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/contexts/BlockNoteContextMenuContext'
import { isNote } from '~/lib/sidebar-item-utils'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { useScrollToHeading } from '~/hooks/useScrollToHeading'
import { useRestoreScrollPosition } from '~/hooks/useRestoreScrollPosition'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function NoteEditor({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { viewAsPlayerId, permissionLevel } = useEditorMode()

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  const isViewOnly =
    viewAsPlayerId &&
    permissionLevel !== 'edit' &&
    permissionLevel !== 'full_access'

  if (isViewOnly) {
    return <NoteViewer item={note} />
  }

  return (
    <ClientOnly fallback={null}>
      <NoteEditorSync key={note._id} noteWithContent={note} />
    </ClientOnly>
  )
}

const NoteEditorSync = ({
  noteWithContent,
}: {
  noteWithContent: NoteWithContent
}) => {
  const { editorMode } = useEditorMode()

  const sync = useBlockNoteSync<CustomBlockNoteEditor>(
    api.prosemirrorSync,
    noteWithContent._id,
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
    <NoteEditorReady
      editor={sync.editor}
      noteWithContent={noteWithContent}
      editorMode={editorMode}
      scrollAreaRef={scrollAreaRef}
    />
  )
}

const NoteEditorReady = ({
  editor,
  noteWithContent,
  editorMode,
  scrollAreaRef,
}: {
  editor: CustomBlockNoteEditor
  noteWithContent: NoteWithContent
  editorMode: string
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
}) => {
  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)
  const { isScrollingToHeading } = useScrollToHeading(
    noteWithContent.content,
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
        className="flex-1 min-h-0"
        onContextMenu={handleWrapperContextMenu}
      >
        <div className="note-editor-fill-height">
          <BlockNoteView
            className="mx-auto w-full max-w-3xl mt-2"
            key={noteWithContent._id + 'editor'}
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
