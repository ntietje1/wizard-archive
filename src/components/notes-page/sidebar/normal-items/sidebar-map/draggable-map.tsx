import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/shadcn/utils'
import type { GameMap } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import { MapPin } from '~/lib/icons'
import { UNTITLED_MAP_NAME } from 'convex/gameMaps/types'
import type { SidebarDragData } from '../../dnd-utils'

interface DraggableMapProps {
  map: GameMap
  ancestorIds?: Id<'folders'>[]
  children: React.ReactNode
}

export function DraggableMap({
  map,
  ancestorIds = [],
  children,
}: DraggableMapProps) {
  const dragData: SidebarDragData = {
    _id: map._id,
    type: map.type,
    parentFolderId: map.parentFolderId,
    categoryId: map.categoryId,
    ancestorIds,
    name: map.name || UNTITLED_MAP_NAME,
    icon: MapPin,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: map._id,
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
