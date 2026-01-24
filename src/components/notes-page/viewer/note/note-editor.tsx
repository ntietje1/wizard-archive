import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useCallback, useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { WikiLinkAutocomplete } from '../../editor/extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../editor/extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import { NoteViewer } from './note-viewer'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { CustomBlock, CustomBlockNoteEditor } from '~/lib/editor-schema'
import { openBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/contexts/BlockNoteContextMenuContext'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { useNoteContent } from '~/hooks/useNoteContent'
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
  const { viewAsPlayerId } = useEditorMode()
  const { updateContent } = useNoteContent(note._id)

  // When viewing as a player, show the viewer instead
  if (viewAsPlayerId) {
    return <NoteViewer item={note} />
  }

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  return (
    <ClientOnly fallback={null}>
      <NoteEditorBase
        key={note._id}
        noteWithContent={note}
        updateContent={updateContent}
      />
    </ClientOnly>
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
        <div className="note-editor-fill-height">
          <BlockNoteView
            className="mx-auto w-full max-w-3xl mt-2"
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
