import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '~/lib/shadcn/utils'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { usePageLayout } from '~/hooks/usePageLayout'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { useCampaign } from '~/contexts/CampaignContext'
import type { EditorViewerProps } from '~/lib/editor-registry'
import { SidebarItemEditor } from './sidebar-item-editor'

export function PageEditorWrapper({
  item,
  search,
}: EditorViewerProps<AnySidebarItem>) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const { pages, currentPageItem, pageSlug, selectPage, handleCreatePage } =
    usePageLayout({
      itemId: item._id,
      itemSlug: item.slug,
      campaignId,
    })

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <PageTabs
        pages={pages.data ?? [item]}
        pageSlug={pageSlug}
        onSelectPage={selectPage}
        onCreatePage={handleCreatePage}
      />
      <div className="flex-1 overflow-hidden">
        {currentPageItem && (
          <SidebarItemEditor item={currentPageItem} search={search} />
        )}
      </div>
    </div>
  )
}

interface PageTabsProps {
  pages: AnySidebarItem[]
  pageSlug: string | undefined
  onSelectPage: (slug: string | undefined) => void
  onCreatePage: () => void
}

export function PageTabs({
  pages,
  pageSlug,
  onSelectPage,
  onCreatePage,
}: PageTabsProps) {
  const parentItem = pages[0] // First page is always the parent item
  const childPages = pages.slice(1) // Rest are child pages

  return (
    <div className="flex items-center border-b px-4 bg-muted/20 overflow-x-auto no-scrollbar">
      {/* Parent item tab (first tab) */}
      {parentItem && (
        <button
          key={parentItem._id}
          onClick={() => onSelectPage(undefined)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            pageSlug === undefined
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          {(() => {
            const Icon = getSidebarItemIcon(parentItem)
            return <Icon className="w-4 h-4" />
          })()}
          {parentItem.name || defaultItemName(parentItem)}
        </button>
      )}
      {/* Child pages tabs */}
      {childPages.map((page) => (
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
          {(() => {
            const Icon = getSidebarItemIcon(page)
            return <Icon className="w-4 h-4" />
          })()}
          {page.name || defaultItemName(page)}
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
