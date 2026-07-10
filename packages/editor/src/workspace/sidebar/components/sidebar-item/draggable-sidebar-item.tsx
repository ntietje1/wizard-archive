import type { AnyItem } from '../../../items'
import { useDraggable } from '../../../../drag-drop/use-draggable'
import { useSidebarDragData } from '../../../../drag-drop/sidebar-drag-data'
import type { SidebarDragDataSource } from '../../../../drag-drop/sidebar-drag-data'
import { useDndStore } from '../../../../drag-drop/store'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface DraggableSidebarItemProps {
  children: React.ReactNode
  canDrag: boolean
  disabled?: boolean
  dragDataSource: SidebarDragDataSource
  item: AnyItem
}

export function DraggableSidebarItem({
  children,
  canDrag,
  disabled = false,
  dragDataSource,
  item,
}: DraggableSidebarItemProps) {
  const dragData = useSidebarDragData(item, dragDataSource)
  const isDragging = useDndStore((state) => state.dragPreviewItemIds.includes(item.id))

  const { draggableRef } = useDraggable({
    data: dragData,
    canDrag: canDrag && !disabled,
  })

  return (
    <div
      className={cn('w-full min-w-0', isDragging && 'opacity-50')}
      data-item-dragging={isDragging ? 'true' : undefined}
      ref={draggableRef}
    >
      {children}
    </div>
  )
}
