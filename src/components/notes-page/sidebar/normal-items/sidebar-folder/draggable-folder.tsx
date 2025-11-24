import { useDraggable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import type { Folder } from 'convex/folders/types'
import type { Id } from 'convex/_generated/dataModel'
import { Folder as FolderIcon } from '~/lib/icons'
import { UNTITLED_FOLDER_NAME } from 'convex/folders/types'
import type { SidebarDragData } from '../../dnd-utils'

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
  const dragData: SidebarDragData = {
    _id: folder._id,
    type: folder.type,
    parentFolderId: folder.parentFolderId,
    categoryId: folder.categoryId,
    ancestorIds,
    name: folder.name || UNTITLED_FOLDER_NAME,
    icon: FolderIcon,
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
