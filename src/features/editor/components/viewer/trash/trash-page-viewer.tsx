import { useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { ItemCard } from '../folder/item-card'
import { ContentGrid } from '~/features/campaigns/components/content-grid/content-grid'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { TrashBanner } from '~/features/editor/components/deleted-item-banner'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useTrashSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { cn } from '~/features/shadcn/lib/utils'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'

export function TrashPageViewer() {
  const dropRef = useRef<HTMLDivElement>(null)

  const { parentItemsMap, status } = useTrashSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const visibleItemIds = rootTrashedItems.map((item) => item._id)
  const { handleSurfacePointerDown } = useItemSurfaceRegistration({
    surface: 'trash',
    parentId: null,
    visibleItemIds,
  })

  const { isDropTarget } = useDndDropTarget({
    ref: dropRef,
    data: { type: TRASH_DROP_ZONE_TYPE },
    highlightId: TRASH_DROP_ZONE_TYPE,
  })
  const isTrashDrag = useDndStore(
    (s) => isDropTarget && s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  return (
    <EditorContextMenu viewContext="trash-view" className="flex flex-col h-full w-full min-h-0">
      <div
        ref={dropRef}
        className={cn(
          'group/sidebar-surface flex flex-col h-full w-full min-h-0',
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
            <Trash2 className="size-10 opacity-30" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <>
            <TrashBanner />
            <ScrollArea className="flex-1 min-h-0">
              <div className="w-full min-w-0" onPointerDownCapture={handleSurfacePointerDown}>
                <ContentGrid className="p-6 min-h-0">
                  {rootTrashedItems.map((item) => (
                    <ItemCard
                      key={item._id}
                      item={item}
                      itemSurface="trash"
                      visibleItemIds={visibleItemIds}
                    />
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
