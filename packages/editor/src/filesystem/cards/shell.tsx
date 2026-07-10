import type { MouseEvent, ReactNode } from 'react'
import type { AnyItem } from '../../workspace/items'
import { MoreVertical } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import { Card, CardTitle } from '@wizard-archive/ui/shadcn/components/card'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { SidebarItemVisualState } from '../../workspace/sidebar/item-visual-state'
import {
  sidebarItemNameClass,
  sidebarItemIconClass,
} from '../../workspace/sidebar/item-visual-state'
import { useContextMenu } from '../../context-menu/hooks/use-context-menu'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { useDraggable } from '../../drag-drop/use-draggable'
import { useItemSelectionInteractions } from '../../workspace/sidebar/use-item-selection-interactions'
import { useSidebarDragData } from '../../drag-drop/sidebar-drag-data'
import { useDndStore } from '../../drag-drop/store'
import { resourceItemCardBackgroundClass, resourceItemCardOutlineClass } from './visual-state'

type ResourceItemCardSource = Pick<
  ItemCardProps<AnyItem>['source'],
  'canDragItem' | 'currentItemId' | 'getSidebarDragData' | 'openItem'
>

export type ResourceItemCardProps<TItem extends AnyItem> = Omit<ItemCardProps<TItem>, 'source'> & {
  source: ResourceItemCardSource
}

export function ResourceItemCardShell<TItem extends AnyItem>({
  item,
  onClick,
  parentId,
  source,
  visibleItemIds,
  itemSurface = 'folder-view',
  preview,
  visualState,
}: ResourceItemCardProps<TItem> & {
  preview: ReactNode
  visualState: SidebarItemVisualState
}) {
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: itemSurface,
    parentId: parentId ?? null,
    visibleItemIds: visibleItemIds ?? [item.id],
  })
  const dragData = useSidebarDragData(item, source)
  const isDragging = useDndStore((state) => state.dragPreviewItemIds.includes(item.id))
  const canDrag = source.canDragItem(item)
  const { draggableRef, isDraggingRef } = useDraggable({ data: dragData, canDrag })
  const handleCardClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDraggingRef.current) {
      event.preventDefault()
      return
    }
    if (onClick) {
      event.preventDefault()
      handleItemClick(event)
      onClick()
      return
    }
    handleItemClick(event, () => void source.openItem(item.id))
  }

  return (
    <WorkspaceContextMenu
      ref={contextMenuRef}
      viewContext={itemSurface === 'trash' ? 'trash-view' : 'folder-view'}
      item={item}
    >
      <div
        ref={draggableRef}
        className={cn('group/resource-card relative w-full h-[140px]', isDragging && 'opacity-50')}
      >
        <button
          type="button"
          aria-label={item.name}
          data-item-selection-target="true"
          className="block w-full h-full text-left"
          draggable={false}
          onContextMenu={handleItemContextMenu}
          onClick={handleCardClick}
        >
          <Card
            className={cn(
              'w-full h-full cursor-pointer group flex flex-col p-2 relative rounded-md',
              resourceItemCardBackgroundClass(visualState),
              resourceItemCardOutlineClass(visualState),
            )}
          >
            <div className="flex items-center justify-between mb-1 min-w-0">
              <CardTitle
                className={cn(
                  'p-1 text-sm font-medium truncate select-none flex-1 min-w-0',
                  sidebarItemNameClass(visualState),
                )}
              >
                {item.name}
              </CardTitle>
            </div>
            {preview}
          </Card>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-item-action-hover rounded-sm opacity-0 group-hover/resource-card:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`More options for ${item.name}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleItemContextMenu(event)
            handleMoreOptions(event)
          }}
        >
          <MoreVertical className={cn('size-4', sidebarItemIconClass(visualState))} />
        </Button>
      </div>
    </WorkspaceContextMenu>
  )
}
