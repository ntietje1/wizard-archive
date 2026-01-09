import { ClientOnly } from '@tanstack/react-router'
import { toast } from 'sonner'
import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarItem } from './sidebar-item/sidebar-item'
import { Button } from '~/components/shadcn/ui/button'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useCampaign } from '~/hooks/useCampaign'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'

function FileSidebarContent() {
  const sidebarItems = useSidebarItemsByParent()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { setRenamingId } = useFileSidebar()
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

  if (sidebarItems.status === 'pending') {
    return <SidebarLoading />
  }

  return (
    <DroppableRoot className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 min-w-0 w-full mr-[1px]">
        <div className="p-1 min-w-0 w-full max-w-full">
          {sidebarItems.data?.map((item) => (
            <SidebarItem key={item._id} item={item} />
          ))}

          {sidebarItems.data && sidebarItems.data.length === 0 && (
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
      </ScrollArea>
    </DroppableRoot>
  )
}

export function FileSidebar() {
  return (
    <ClientOnly fallback={<SidebarLoading />}>
      <FileSidebarContent />
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
