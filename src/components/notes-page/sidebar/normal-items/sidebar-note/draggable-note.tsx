import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import type { Note } from 'convex/notes/types'
import type { Id } from 'convex/_generated/dataModel'
import { FileText } from '~/lib/icons'
import { UNTITLED_NOTE_TITLE } from 'convex/notes/types'
import type { SidebarDragData } from '../../dnd-utils'

interface DraggableNoteProps {
  note: Note
  ancestorIds?: Id<'folders'>[]
  children: React.ReactNode
}

export function DraggableNote({
  note,
  ancestorIds = [],
  children,
}: DraggableNoteProps) {
  const dragData: SidebarDragData = {
    _id: note._id,
    type: note.type,
    parentFolderId: note.parentFolderId,
    categoryId: note.categoryId,
    ancestorIds,
    name: note.name || UNTITLED_NOTE_TITLE,
    icon: FileText,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: note._id,
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
