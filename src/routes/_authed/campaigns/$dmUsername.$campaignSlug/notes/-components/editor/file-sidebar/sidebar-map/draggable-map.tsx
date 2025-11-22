import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import type { GameMap } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'

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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: map._id,
    data: {
      ...map,
      ancestorIds,
    },
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
