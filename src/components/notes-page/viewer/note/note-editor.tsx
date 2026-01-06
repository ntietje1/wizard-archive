import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useMemo } from 'react'
import TagMenu from '../../editor/extensions/side-menu/tags/tag-menu'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { Note, NoteWithContent } from 'convex/notes/types'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
  CustomPartialBlock,
} from '~/lib/editor-schema'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { NotesByTagViewer } from '~/components/notes-page/viewer/note/notes-by-tag-viewer'
import { useNoteContent } from '~/hooks/useNoteContent'

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
  const initialContent = useMemo(
    () =>
      noteWithContent.content.length > 0
        ? (noteWithContent.content as Array<CustomPartialBlock>)
        : undefined,
    [noteWithContent],
  )
  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
  })

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="note-editor-content"
      className="flex-1 min-h-0"
    >
      <ResizablePanel
        defaultSize={50}
        minSize={25}
        className="flex min-h-0 flex-col"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
            <BlockNoteView
              key={noteWithContent._id}
              editor={editor}
              onChange={() => updateContent(editor.document)}
              theme="light"
              sideMenu={false}
              formattingToolbar={false}
              slashMenu={false}
            >
              <TagMenu editor={editor} />
              <SideMenuController sideMenu={SideMenuRenderer} />
              <SelectionToolbar />
              <SlashMenu editor={editor} />
            </BlockNoteView>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        defaultSize={50}
        minSize={25}
        className="flex min-h-0 flex-col"
      >
        <NotesByTagViewer />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
