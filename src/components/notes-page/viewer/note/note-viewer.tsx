import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { editorSchema } from '~/lib/editor-schema'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { useEditorMode } from '~/hooks/useEditorMode'

export function NoteViewer({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { viewAsPlayerId } = useEditorMode()

  return (
    <ClientOnly fallback={null}>
      <NoteViewerBase
        key={note._id + '-' + viewAsPlayerId}
        noteWithContent={note}
      />
    </ClientOnly>
  )
}

export const NoteViewerBase = ({
  noteWithContent,
}: {
  noteWithContent: NoteWithContent
}) => {
  const initialContent =
    noteWithContent.content.length > 0 ? noteWithContent.content : undefined

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
  })

  useEffect(() => {
    editor.replaceBlocks(editor.document, noteWithContent.content)
  }, [editor, noteWithContent.content])

  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)

  return (
    <ScrollArea className="flex-1">
      <BlockNoteView
        className="mx-auto w-full max-w-3xl mt-2"
        key={noteWithContent._id + 'viewer'}
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
