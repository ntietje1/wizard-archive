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
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import { Plus, StickyNote, Map as MapIcon } from 'lucide-react'
import { cn } from '~/lib/utils'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { isNote, isGameMap } from '~/lib/sidebar-item-utils'
import type { Id } from 'convex/_generated/dataModel'
import { usePageLayout } from '~/hooks/usePageLayout'

interface PageEditorProps {
  parentId: SidebarItemId | undefined
  parentSlug: string | undefined
  campaignId: Id<'campaigns'> | undefined
  emptyMessage?: string
  emptyButtonText?: string
}

export function PageEditor({
  parentId,
  parentSlug,
  campaignId,
  emptyMessage = 'This item has no pages. Create a page to start editing.',
  emptyButtonText = 'Create First Page',
}: PageEditorProps) {
  const {
    pages,
    currentPage,
    pageSlug,
    selectPage,
    handleCreatePage,
    updateCurrentPageContent,
  } = usePageLayout({
    parentId,
    parentSlug,
    campaignId,
  })

  if (!parentSlug) {
    return <PageEditorEmptyContent />
  }

  if (pages.status === 'pending') {
    return <PageEditorSkeleton />
  }

  // Handle items without child items (pages)
  if (!pages.data || pages.data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
        <p>{emptyMessage}</p>
        <Button variant="outline" onClick={handleCreatePage}>
          {emptyButtonText}
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
  pages: AnySidebarItem[]
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
          {isGameMap(page) ? (
            <MapIcon className="w-4 h-4" />
          ) : (
            <StickyNote className="w-4 h-4" />
          )}
          {isNote(page) ? page.name || 'Untitled' : page.name || 'Untitled Map'}
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
  page: (AnySidebarItem & { content?: any }) | null | undefined
  onUpdate: (content: any) => void
}

function PageContent({ page, onUpdate }: PageContentProps) {
  if (!page) return null

  // Maps don't have content/blocks, show a placeholder
  if (isGameMap(page)) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-muted-foreground">
            <MapIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Map content will be displayed here</p>
          </div>
        </div>
      </div>
    )
  }

  // Only notes have content
  if (page.type !== 'notes') return null

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

export function PageEditorEmptyContent() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
      <p>Select an item to get started</p>
    </div>
  )
}

export function PageEditorSkeleton() {
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
