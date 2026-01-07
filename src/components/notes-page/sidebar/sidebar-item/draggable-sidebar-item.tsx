import { useDraggable } from '@dnd-kit/core'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { getSidebarItemIcon } from '~/lib/category-icons'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  children: React.ReactNode
}

function getDragData(
  item: AnySidebarItem,
  ancestorIds: Array<SidebarItemId>,
): SidebarDragData {
  return {
    _id: item._id,
    type: item.type,
    parentId: item.parentId,
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
