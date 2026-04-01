import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { editorSchema } from 'convex/notes/editorSpecs'
import { api } from 'convex/_generated/api'
import { EDITOR_MODE } from 'convex/editors/types'
import SelectionToolbar from '../../extensions/selection-toolbar/selection-toolbar'
import { WikiLinkAutocomplete } from '../../extensions/wiki-link/wiki-link-autocomplete'
import { WikiLinkClickHandler } from '../../extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../extensions/md-link/md-link-click-handler'
import { BlockNoteContextMenuHandler } from '../../extensions/blocknote-context-menu/blocknote-context-menu-handler'
import { PreventExternalDrop } from '../../extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from '../../extensions/side-menu/side-menu'
import { SlashMenu } from '../../extensions/slash-menu/slash-menu'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type { Doc } from 'yjs'
import '../../extensions/wiki-link/wiki-link.css'
import '../../extensions/md-link/md-link.css'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorMode } from 'convex/editors/types'
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
import { useConvexYjsCollaboration } from '~/features/editor/hooks/useConvexYjsCollaboration'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

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
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  useEffect(() => {
    const initialContent = content.length > 0 ? content : undefined
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent,
    }) as CustomBlockNoteEditor

    setEditor(instance)

    return () => {
      instance._tiptapEditor.destroy()
    }
  }, [])

  useEffect(() => {
    if (editor) {
      editor.replaceBlocks(editor.document, content)
    }
  }, [editor, content])

  if (!editor) return null

  return (
    <ReadOnlyNoteReady editor={editor} noteId={noteId} theme={resolvedTheme} />
  )
}

const ReadOnlyNoteReady = ({
  editor,
  noteId,
  theme,
}: {
  editor: CustomBlockNoteEditor
  noteId: Id<'notes'>
  theme: 'light' | 'dark'
}) => {
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
        theme={theme}
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
// Collaborative editor – Yjs powered
// ---------------------------------------------------------------------------

const CURSOR_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  '#61afef',
  '#c678dd',
  '#d19a66',
  '#be5046',
]

function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

const CollaborativeNote = ({ note }: { note: NoteWithContent }) => {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data

  const userName = profile?.name ?? profile?.username ?? 'Anonymous'
  const userColor = profile ? getCursorColor(profile._id) : '#61afef'

  const { doc, provider, instanceId, isLoading } = useConvexYjsCollaboration(
    note._id,
    { name: userName, color: userColor },
  )

  if (isLoading || !doc || !provider) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <CollaborativeNoteWithEditor
      key={instanceId}
      doc={doc}
      provider={provider}
      note={note}
      user={{ name: userName, color: userColor }}
    />
  )
}

const CollaborativeNoteWithEditor = ({
  doc,
  provider,
  note,
  user,
}: {
  doc: Doc
  provider: ConvexYjsProvider
  note: NoteWithContent
  user: { name: string; color: string }
}) => {
  const { editorMode } = useEditorMode()
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  useEffect(() => {
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document'),
        user: { name: user.name, color: user.color },
        showCursorLabels: 'activity',
      },
    }) as CustomBlockNoteEditor

    setEditor(instance)

    return () => {
      instance._tiptapEditor.destroy()
    }
  }, [doc, provider, user.name, user.color])

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  if (!editor) return null

  return (
    <CollaborativeNoteReady
      editor={editor}
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
  editorMode: EditorMode
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
              editable={editorMode === EDITOR_MODE.EDITOR}
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
