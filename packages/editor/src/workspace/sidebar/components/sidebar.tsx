import { BookmarkedItemsList } from './bookmarked-items-list'
import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarList } from './sidebar-list'
import { SidebarLoadingSkeleton } from './sidebar-loading-skeleton'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import { useSidebarWorkspaceState } from '../workspace-state'
import type { SidebarTreeSource } from './sidebar-tree-source'

export function FileSidebar({ source }: { source: SidebarTreeSource }) {
  const {
    ui: { bookmarksOnlyMode },
  } = useSidebarWorkspaceState()

  if (source.activeStatus === 'pending') {
    return <SidebarLoading />
  }

  if (source.activeStatus === 'error') {
    return <SidebarError error={source.activeError} onRetry={source.refreshActive} />
  }

  if (bookmarksOnlyMode) {
    return (
      <ClientOnly fallback={<SidebarLoading />}>
        <BookmarkedItemsList source={source} />
      </ClientOnly>
    )
  }
  return (
    <ClientOnly fallback={<SidebarLoading />}>
      <DroppableRoot
        canDrop={source.canDropOnRoot}
        className="flex-1 flex min-h-0 min-w-0 overflow-hidden"
      >
        <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
          <SidebarList source={source} />
        </div>
      </DroppableRoot>
    </ClientOnly>
  )
}

function SidebarError({ error, onRetry }: { error: unknown; onRetry: () => unknown }) {
  const message = error instanceof Error ? error.message : null

  return (
    <div className="flex-1 p-3 text-sm text-muted-foreground">
      <p className="text-destructive">Failed to load sidebar items.</p>
      {message && <p className="mt-1 text-destructive">{message}</p>}
      <p className="mt-1">Please try again, or refresh the page if the problem continues.</p>
      <button type="button" className="mt-2 text-primary underline" onClick={() => void onRetry()}>
        Try Again
      </button>
    </div>
  )
}

function SidebarLoading() {
  return <SidebarLoadingSkeleton rows={['w-3/4', 'w-1/2', 'w-5/6', 'w-2/3', 'w-4/5']} />
}
