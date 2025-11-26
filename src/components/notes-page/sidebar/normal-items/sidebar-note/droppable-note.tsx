import { useDroppable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { Note } from 'convex/notes/types'
import { canDropItem } from '../../dnd-utils'
import type { Id } from 'convex/_generated/dataModel'

interface DroppableNoteProps {
  note: Note
  ancestorIds?: Id<'notes'>[]
  children: React.ReactNode
}

export function DroppableNote({
  note,
  ancestorIds = [],
  children,
}: DroppableNoteProps) {
  const { setNodeRef, isOver, active, over } = useDroppable({
    id: note._id,
    data: {
      accepts: [SIDEBAR_ITEM_TYPES.notes],
      _id: note._id,
      categoryId: note.categoryId,
      ancestorIds,
      type: SIDEBAR_ITEM_TYPES.notes,
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
