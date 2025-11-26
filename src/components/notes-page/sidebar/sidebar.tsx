import { DroppableRoot } from './sidebar-root/droppable-root'
import { SidebarItem } from './sidebar-item/sidebar-item'
import { CategorySystemFolders } from './category-items/category-system-folders'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { ClientOnly } from '@tanstack/react-router'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { useNoteActions } from '~/hooks/useNoteActions'
import { Button } from '~/components/shadcn/ui/button'
import { useCampaign } from '~/contexts/CampaignContext'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import { DragOverlay } from '@dnd-kit/core'
import { DragOverlayItem } from './sidebar-item/drag-overlays'
import { toast } from 'sonner'

function FileSidebarContent() {
  const sidebarItems = useSidebarItemsByParent()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { activeDragItem, setRenamingId } = useFileSidebar()
  const { createNote } = useNoteActions()

  const handleCreateNote = () => {
    if (!campaignId) return
    createNote.mutateAsync({ campaignId: campaignId })
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
    <DroppableRoot className="flex-1 flex min-h-0">
      <ScrollArea type="always" className="flex-1 min-h-0 overflow-y-auto p-1">
        <CategorySystemFolders />

        <div className="border-t border-muted-foreground/20 my-1" />

        {sidebarItems.data?.map((item) => (
          <SidebarItem key={item._id} item={item} />
        ))}

        {sidebarItems.data?.length === 0 && (
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
      </ScrollArea>
      <DragOverlay dropAnimation={null}>
        {activeDragItem && <DragOverlayItem item={activeDragItem} />}
      </DragOverlay>
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
