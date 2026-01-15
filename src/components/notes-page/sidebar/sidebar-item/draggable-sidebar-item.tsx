import { useDraggable } from '@dnd-kit/core'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  children: React.ReactNode
}

export function DraggableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DraggableSidebarItemProps) {
  const dragData = {
    ...item,
    ancestorIds,
  }

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: item._id,
    data: dragData,
  })

  return (
    <div
      className={cn('flex w-full min-w-0')}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}
