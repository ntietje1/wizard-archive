import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { Note, NoteWithContent } from 'convex/notes/types'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { useEditorMode } from '~/hooks/useEditorMode'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { useSharedNoteContent } from '~/hooks/useSharedNoteContent'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

// TODO: make shared query same as normal query
export function NoteViewer({ item: note }: EditorViewerProps<Note>) {
  const { viewAsPlayerId } = useEditorMode()
  const { sharedNoteQuery: noteQuery } = useSharedNoteContent(
    note._id,
    viewAsPlayerId,
  )

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
        Invalid item type for note viewer.
      </div>
    )
  }

  return (
    <NoteViewerBase
      key={noteQuery.data._id + '-' + viewAsPlayerId}
      noteWithContent={noteQuery.data}
    />
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
