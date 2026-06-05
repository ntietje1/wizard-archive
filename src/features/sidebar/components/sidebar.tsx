import { ClientOnly } from '@tanstack/react-router'
import { BookmarkedItemsList } from './bookmarked-items-list'
import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarList } from './sidebar-list'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignSidebarState } from '~/features/sidebar/stores/sidebar-ui-store'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

export function FileSidebar() {
  const { status, error, refetch } = useActiveSidebarItems()
  const { campaignId } = useCampaign()
  const { bookmarksOnlyMode } = useCampaignSidebarState(campaignId)

  if (status === 'pending') {
    return <SidebarLoading />
  }

  if (status === 'error') {
    return <SidebarError error={error} onRetry={refetch} />
  }

  if (bookmarksOnlyMode) {
    return (
      <ClientOnly fallback={<SidebarLoading />}>
        <BookmarkedItemsList />
      </ClientOnly>
    )
  }
  return (
    <ClientOnly fallback={<SidebarLoading />}>
      <DroppableRoot className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
          <SidebarList />
        </div>
      </DroppableRoot>
    </ClientOnly>
  )
}

function SidebarError({ error, onRetry }: { error: unknown; onRetry: () => unknown }) {
  return (
    <div className="flex-1 p-3 text-sm text-muted-foreground">
      <p className="text-destructive">Failed to load sidebar items.</p>
      <p className="mt-1">{getErrorMessage(error)}</p>
      <button type="button" className="mt-2 text-primary underline" onClick={() => void onRetry()}>
        Try Again
      </button>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function SidebarLoading() {
  return (
    <div className="flex-1 p-2">
      <div className="space-y-2">
        <div className="bg-muted rounded-md h-4 w-3/4" />
        <div className="bg-muted rounded-md h-4 w-1/2" />
        <div className="bg-muted rounded-md h-4 w-5/6" />
        <div className="bg-muted rounded-md h-4 w-2/3" />
        <div className="bg-muted rounded-md h-4 w-4/5" />
      </div>
    </div>
  )
}
