import { BlockNoteView } from '@blocknote/shadcn'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { Button } from '~/components/shadcn/ui/button'
import TagMenu from './extensions/side-menu/tags/tag-menu'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import SelectionToolbar from './extensions/selection-toolbar/selection-toolbar'
import { editorSchema, type CustomPartialBlock } from '~/lib/editor-schema'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { ClientOnly } from '@tanstack/react-router'
import { toast } from 'sonner'

export function NotesEditor() {
  return (
    <ClientOnly fallback={<NotesEditorSkeleton />}>
      <NotesEditorBase />
    </ClientOnly>
  )
}
function NotesEditorBase() {
  const { note, noteSlug, updateCurrentNoteContent } = useCurrentNote()

  const hasContent =
    note?.data && note?.data?.content && note?.data?.content.length > 0

  const editor = useCreateBlockNote(
    {
      schema: editorSchema,
      ...(hasContent && {
        initialContent: note.data.content as CustomPartialBlock[],
      }),
    },
    [note?.data?._id],
  )

  if (!noteSlug) {
    return <NotesEditorEmptyContent />
  }

  if (!note || note.status === 'pending') {
    return <NotesEditorSkeleton />
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <BlockNoteView
          editor={editor}
          onChange={() => updateCurrentNoteContent(editor.document)}
          theme="light"
          sideMenu={false}
          formattingToolbar={false}
        >
          <TagMenu editor={editor} />
          <SideMenuController sideMenu={SideMenuRenderer} />
          <SelectionToolbar />
        </BlockNoteView>
      </div>
    </div>
  )
}

export function NotesEditorEmptyContent() {
  const { createNote } = useNoteActions()
  const { selectNote } = useCurrentNote()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleCreateNote = async () => {
    if (!campaignId) return
    await createNote
      .mutateAsync({ campaignId: campaignId })
      .then(({ slug }) => {
        selectNote(slug)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create note')
      })
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
      <p>Select a note or create a new one to get started</p>
      <Button variant="outline" onClick={handleCreateNote}>
        New note
      </Button>
    </div>
  )
}

export function NotesEditorSkeleton() {
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
