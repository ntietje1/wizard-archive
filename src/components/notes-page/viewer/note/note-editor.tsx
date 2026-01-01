import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useEffect, useMemo } from 'react'
import { debounce } from 'lodash-es'
import TagMenu from '../../editor/extensions/side-menu/tags/tag-menu'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '~/lib/editor-registry'
import type { Note } from 'convex/notes/types'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
  CustomPartialBlock,
} from '~/lib/editor-schema'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { useNoteActions } from '~/hooks/useNoteActions'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { NotesByTagViewer } from '~/components/notes-page/viewer/note/notes-by-tag-viewer'

export function NoteEditor({ item: note }: EditorViewerProps<Note>) {
  const { updateNoteContentWithSanitization } = useNoteActions()

  // Fetch note content
  const noteQuery = useQuery(
    convexQuery(api.notes.queries.getNoteWithContent, { noteId: note._id }),
  )

  const initialContent = noteQuery.data?.content

  // Debounced content update
  const updateContent = useMemo(
    () =>
      debounce((newContent: Array<CustomBlock>) => {
        updateNoteContentWithSanitization(note._id, newContent)
      }, 800),
    [updateNoteContentWithSanitization, note._id],
  )

  useEffect(() => {
    return () => {
      updateContent.flush()
    }
  }, [note._id, updateContent])

  const hasContent = initialContent && initialContent.length > 0

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    ...(hasContent && {
      initialContent: initialContent as Array<CustomPartialBlock>,
    }),
  })

  if (noteQuery.isLoading) {
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

  // TODO: query seems to be cached and not updated when note is updated

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
              key={note._id}
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
