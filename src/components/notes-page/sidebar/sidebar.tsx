import { toast } from 'sonner'
import { BookmarkedItemsList } from './bookmarked-items-list'
import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarList } from './sidebar-list'
import { Button } from '~/components/shadcn/ui/button'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useCampaign } from '~/hooks/useCampaign'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

export function FileSidebar() {
  const { status, data: allItems } = useAllSidebarItems()
  const isEmpty = allItems.length === 0
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { setRenamingId, bookmarksOnlyMode } = useFileSidebar()
  const { createNote } = useNoteActions()

  const handleCreateNote = () => {
    if (!campaignId) return
    createNote
      .mutateAsync({ campaignId })
      .then(({ noteId }) => {
        setRenamingId(noteId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create note')
      })
  }

  if (bookmarksOnlyMode) {
    return <BookmarkedItemsList />
  }

  if (status === 'pending') {
    return <SidebarLoading />
  }

  return (
    <DroppableRoot className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
        <SidebarList />

        {isEmpty && (
          <div className="flex flex-col gap-2 mx-8 my-4 text-muted-foreground items-center">
            <Button
              className="max-w-24"
              variant="outline"
              onClick={handleCreateNote}
            >
              New note
            </Button>
          </div>
        )}
      </div>
    </DroppableRoot>
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
