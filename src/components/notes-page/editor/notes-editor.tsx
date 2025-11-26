import { BlockNoteView } from '@blocknote/shadcn'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { Button } from '~/components/shadcn/ui/button'
import TagMenu from './extensions/side-menu/tags/tag-menu'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import SelectionToolbar from './extensions/selection-toolbar/selection-toolbar'
import {
  editorSchema,
  type CustomBlockNoteEditor,
  type CustomPartialBlock,
} from '~/lib/editor-schema'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useCurrentPage } from '~/hooks/useCurrentPage'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { ClientOnly } from '@tanstack/react-router'
import { toast } from 'sonner'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import { Plus, StickyNote, Map as MapIcon } from 'lucide-react'
import { cn } from '~/lib/utils'

export function NotesEditor() {
  return (
    <ClientOnly fallback={<NotesEditorSkeleton />}>
      <NotesEditorBase />
    </ClientOnly>
  )
}

function NotesEditorBase() {
  const { note, noteSlug } = useCurrentNote()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const {
    pages,
    currentPage,
    pageSlug,
    selectPage,
    handleCreatePage,
    updateCurrentPageContent,
  } = useCurrentPage(noteSlug, campaignId)

  if (!noteSlug) {
    return <NotesEditorEmptyContent />
  }

  if (!note || note.status === 'pending' || pages.status === 'pending') {
    return <NotesEditorSkeleton />
  }

  // Handle notes without pages (folder-notes)
  if (!pages.data || pages.data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
        <p>This note has no pages. Create a page to start editing.</p>
        <Button variant="outline" onClick={handleCreatePage}>
          Create First Page
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <PageTabs
        pages={pages.data}
        pageSlug={pageSlug}
        onSelectPage={selectPage}
        onCreatePage={handleCreatePage}
      />
      <PageContent
        page={currentPage ?? undefined}
        onUpdate={updateCurrentPageContent}
      />
    </div>
  )
}

interface PageTabsProps {
  pages: Array<{ _id: string; slug: string; title: string; type: string }>
  pageSlug: string | undefined
  onSelectPage: (slug: string) => void
  onCreatePage: () => void
}

function PageTabs({
  pages,
  pageSlug,
  onSelectPage,
  onCreatePage,
}: PageTabsProps) {
  return (
    <div className="flex items-center border-b px-4 bg-muted/20 overflow-x-auto no-scrollbar">
      {pages.map((page) => (
        <button
          key={page._id}
          onClick={() => onSelectPage(page.slug)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            pageSlug === page.slug
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          {page.type === 'map' ? (
            <MapIcon className="w-4 h-4" />
          ) : (
            <StickyNote className="w-4 h-4" />
          )}
          {page.title}
        </button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="ml-2 h-8 w-8 rounded-full"
        onClick={onCreatePage}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  )
}

interface PageContentProps {
  page: { _id: string; content?: any } | null | undefined
  onUpdate: (content: any) => void
}

function PageContent({ page, onUpdate }: PageContentProps) {
  if (!page) return null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <BlockNoteEditor
          key={page._id}
          initialContent={page.content}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  )
}

function BlockNoteEditor({
  initialContent,
  onUpdate,
}: {
  initialContent: any
  onUpdate: (content: any) => void
}) {
  const hasContent = initialContent && initialContent.length > 0

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    ...(hasContent && {
      initialContent: initialContent as CustomPartialBlock[],
    }),
  })

  return (
    <BlockNoteView
      editor={editor}
      onChange={() => onUpdate(editor.document)}
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
      .catch((error: unknown) => {
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
      <div className="h-12 border-b bg-muted/20" />
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
