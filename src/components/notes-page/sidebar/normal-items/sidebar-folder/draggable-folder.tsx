import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import type { Folder } from 'convex/notes/types'
import type { Id } from 'convex/_generated/dataModel'

interface DraggableFolderProps {
  folder: Folder
  ancestorIds?: Array<Id<'folders'>>
  children: React.ReactNode
}

export function DraggableFolder({
  folder,
  ancestorIds = [],
  children,
}: DraggableFolderProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: folder._id,
    data: {
      ...folder,
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
