import { useRef } from 'react'
import { ItemCard } from '../folder/item-card'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { TrashBanner } from '~/components/notes-page/editor/deleted-item-banner'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Trash2 } from '~/lib/icons'

export function TrashPageViewer() {
  const dropRef = useRef<HTMLDivElement>(null)

  const { parentItemsMap, status } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []

  const { isDropTarget } = useDndDropTarget({
    ref: dropRef,
    data: { type: TRASH_DROP_ZONE_TYPE },
    highlightId: TRASH_DROP_ZONE_TYPE,
  })
  const isTrashDrag = useSidebarUIStore(
    (s) =>
      isDropTarget &&
      s.dragOutcome?.type === 'operation' &&
      s.dragOutcome.action === 'trash',
  )

  return (
    <EditorContextMenu
      viewContext="trash-view"
      className="flex flex-col h-full w-full min-h-0"
    >
      <div
        ref={dropRef}
        className={cn(
          'flex flex-col h-full w-full min-h-0',
          isTrashDrag
            ? 'ring-2 ring-inset ring-destructive/60 bg-destructive/5'
            : isDropTarget && 'ring-2 ring-inset ring-ring/60 bg-ring/5',
        )}
      >
        {status === 'pending' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : status === 'error' ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">Failed to load trash</p>
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
