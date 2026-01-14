import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useCallback, useMemo } from 'react'
import { BookOpen, Pencil } from 'lucide-react'
import MentionMenu from '../../editor/extensions/side-menu/mentions/mention-menu'
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
import { useNoteContent } from '~/hooks/useNoteContent'
import { useEditorMode } from '~/hooks/useEditorMode'
import { Button } from '~/components/shadcn/ui/button'

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
    <div className="flex-1 min-h-0 overflow-y-auto relative">
      <div className="absolute top-2 right-2 z-10">
        <EditorViewModeToggleButton />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <BlockNoteView
          key={noteWithContent._id + 'editor'}
          editor={editor}
          onChange={() => updateContent(editor.document)}
          theme="light"
          sideMenu={false}
          formattingToolbar={false}
          slashMenu={false}
        >
          <MentionMenu editor={editor} />
          <SideMenuController sideMenu={SideMenuRenderer} />
          <SelectionToolbar />
          <SlashMenu editor={editor} />
        </BlockNoteView>
      </div>
    </div>
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
