import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import type { Folder } from 'convex/notes/types'

interface DraggableCategoryFolderProps {
  folder?: Folder
  ancestorIds?: string[]
  children: React.ReactNode
}

export function DraggableCategoryFolder({
  folder,
  ancestorIds = [],
  children,
}: DraggableCategoryFolderProps) {
  if (!folder) return children
  const dragData = {
    ...folder,
    ancestorIds,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: folder._id,
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
