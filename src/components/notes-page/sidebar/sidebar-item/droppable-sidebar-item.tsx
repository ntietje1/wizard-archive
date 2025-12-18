import { useDroppable } from '@dnd-kit/core'
import { cn } from '~/lib/shadcn/utils'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { canDropItem } from '~/lib/dnd-utils'
import { validSidebarChildren } from 'convex/sidebarItems/sidebarItems'

interface DroppableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: SidebarItemId[]
  children: React.ReactNode
}

function getDropData(item: AnySidebarItem, ancestorIds: SidebarItemId[]) {
  const accepts = validSidebarChildren[item.type]

  return {
    accepts,
    _id: item._id,
    categoryId: item.categoryId,
    ancestorIds,
    type: item.type,
  }
}

export function DroppableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DroppableSidebarItemProps) {
  const dropData = getDropData(item, ancestorIds)

  const { setNodeRef, isOver, active, over } = useDroppable({
    id: item._id,
    data: dropData,
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = isOver && canDrop

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-colors min-w-0 w-full',
        isValidDrop ? 'bg-muted' : 'bg-background',
      )}
    >
      {children}
    </div>
  )
}
