import { Trash2 } from 'lucide-react'
import { ItemCard } from '../cards/item-card'
import { ContentGrid } from '@wizard-archive/ui/components/content-grid'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { TrashBanner } from './banner'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { useDndDropTarget } from '../../drag-drop/use-drop-target'
import { TRASH_DROP_ZONE_TYPE } from '../../drag-drop/drop-target-data'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useDndStore } from '../../drag-drop/store'
import { useItemSurfaceRegistration } from '../../workspace/sidebar/use-item-surface-registration'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import type { TrashSource } from './source'
import { handleError } from '../../errors/handle-error'

export function TrashPageViewer({ source }: { source: TrashSource }) {
  const status = source.getStatus()
  const rootTrashedItems = source.getRootItems()
  const visibleItemIds = rootTrashedItems.map((item) => item.id)
  const { handleSurfacePointerDown, itemSurfaceHotkeyProps } = useItemSurfaceRegistration({
    surface: 'trash',
    parentId: null,
    visibleItemIds,
  })

  const { dropTargetRef, isDropTarget } = useDndDropTarget({
    data: { type: TRASH_DROP_ZONE_TYPE },
  })
  const isTrashDrag = useDndStore(
    (s) => isDropTarget && s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  return (
    <WorkspaceContextMenu viewContext="trash-view" className="flex flex-col h-full w-full min-h-0">
      <div
        ref={dropTargetRef}
        onPointerDownCapture={handleSurfacePointerDown}
        {...itemSurfaceHotkeyProps}
        className={cn(
          'group/sidebar-surface flex flex-col h-full w-full min-h-0',
          isTrashDrag
            ? dropTargetChromeClass('destructive')
            : isDropTarget && dropTargetChromeClass('default'),
        )}
      >
        {status === 'pending' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : status === 'error' ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">Failed to load trash</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await source.refresh()
                } catch (error) {
                  handleError(error, 'Failed to refresh trash')
                }
              }}
            >
              Retry loading trash
            </Button>
          </div>
        ) : rootTrashedItems.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Trash2 className="size-10 opacity-30" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <>
            <TrashBanner source={source} />
            <ScrollArea className="flex-1 min-h-0">
              <div className="w-full min-w-0">
                <ContentGrid className="p-6 min-h-0">
                  {rootTrashedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      itemSurface="trash"
                      source={source}
                      visibleItemIds={visibleItemIds}
                    />
                  ))}
                </ContentGrid>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </WorkspaceContextMenu>
  )
}
