import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/shadcn/utils'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: SidebarItemId[]
  children: React.ReactNode
}

function getDragData(
  item: AnySidebarItem,
  ancestorIds: SidebarItemId[],
): SidebarDragData {
  return {
    _id: item._id,
    type: item.type,
    parentId: item.parentId,
    categoryId: item.categoryId,
    ancestorIds,
    name: item.name || defaultItemName(item),
    icon: getSidebarItemIcon(item),
  }
}

export function DraggableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DraggableSidebarItemProps) {
  const dragData = getDragData(item, ancestorIds)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item._id,
    data: dragData,
  })

  return (
    <div
      className={cn('flex w-full min-w-0', isDragging && 'opacity-50')}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}
