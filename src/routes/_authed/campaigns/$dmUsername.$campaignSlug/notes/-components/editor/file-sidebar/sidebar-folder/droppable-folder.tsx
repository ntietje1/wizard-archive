import { useDroppable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import { SIDEBAR_ITEM_TYPES, type Folder } from 'convex/notes/types'
import { canDropItem } from '../dnd-utils'
import type { Id } from 'convex/_generated/dataModel'

interface DroppableFolderProps {
  folder: Folder
  ancestorIds?: Id<'folders'>[]
  children: React.ReactNode
}

export function DroppableFolder({
  folder,
  ancestorIds = [],
  children,
}: DroppableFolderProps) {
  const { setNodeRef, isOver, active, over } = useDroppable({
    id: folder._id,
    data: {
      accepts: [SIDEBAR_ITEM_TYPES.folders, SIDEBAR_ITEM_TYPES.notes],
      _id: folder._id,
      categoryId: folder.categoryId,
      ancestorIds,
      type: SIDEBAR_ITEM_TYPES.folders,
    },
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
