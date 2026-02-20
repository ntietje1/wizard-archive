import { ClientOnly } from '@tanstack/react-router'
import { BookmarkedItemsList } from './bookmarked-items-list'
import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarList } from './sidebar-list'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useCampaign } from '~/hooks/useCampaign'
import { useCampaignSidebarState } from '~/stores/sidebarUIStore'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

export function FileSidebar() {
  const { status } = useAllSidebarItems()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { bookmarksOnlyMode } = useCampaignSidebarState(campaignId)

  if (bookmarksOnlyMode) {
    return (
      <ClientOnly fallback={<SidebarLoading />}>
        <BookmarkedItemsList />
      </ClientOnly>
    )
  }

  if (status === 'pending') {
    return <SidebarLoading />
  }

  if (status === 'error') {
    return <SidebarLoading /> // TODO: have a better error state
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

function SidebarLoading() {
  return (
    <div className="flex-1 p-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}
