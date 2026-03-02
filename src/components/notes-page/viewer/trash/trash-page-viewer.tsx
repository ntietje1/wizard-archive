import { useRef } from 'react'
import { ItemCard } from '../folder/item-card'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { TrashBanner } from '~/components/notes-page/editor/deleted-item-banner'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useDroppable } from '~/hooks/useDroppable'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Trash2 } from '~/lib/icons'

export function TrashPageViewer() {
  const dropRef = useRef<HTMLDivElement>(null)

  const {
    parentItemsMap,
    status,
    itemsMap: trashedItemsMap,
  } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(undefined) ?? []

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === TRASH_DROP_ZONE_TYPE,
  )
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)
  const isTrashDrag = isDropTarget && dragDropAction === 'trash'

  useDroppable<{ type: typeof TRASH_DROP_ZONE_TYPE }, SidebarDragData>({
    ref: dropRef,
    data: { type: TRASH_DROP_ZONE_TYPE },
    canDrop: (sourceData) => !trashedItemsMap.has(sourceData.sidebarItemId),
  })

  return (
    <EditorContextMenu
      viewContext="trash-view"
      className="flex flex-col h-full w-full min-h-0"
    >
      <div
        ref={dropRef}
        className={cn(
          'flex flex-col h-full w-full min-h-0 transition-colors',
          isTrashDrag ? 'bg-destructive/10' : isDropTarget && 'bg-muted',
        )}
      >
        {status === 'pending' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : rootTrashedItems.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Trash2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <>
            <TrashBanner />
            <ScrollArea className="flex-1 min-h-0">
              <div className="w-full min-w-0">
                <ContentGrid className="p-6 min-h-0">
                  {rootTrashedItems.map((item) => (
                    <ItemCard key={item._id} item={item} />
                  ))}
                </ContentGrid>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </EditorContextMenu>
  )
}
