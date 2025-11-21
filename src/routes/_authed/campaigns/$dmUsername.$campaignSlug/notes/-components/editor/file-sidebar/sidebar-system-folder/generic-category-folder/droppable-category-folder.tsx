import { useDroppable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types'
import { canDropItem } from '../../dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'

interface DroppableCategoryFolderProps {
  folder?: Folder
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'folders'>[]
  children: React.ReactNode
}

export function DroppableCategoryFolder({
  folder,
  categoryId,
  ancestorIds = [],
  children,
}: DroppableCategoryFolderProps) {
  const targetCategoryId = folder?.categoryId || categoryId
  const dropId = folder?._id || `category-${categoryId}`
  const dropType = folder ? SIDEBAR_ITEM_TYPES.folders : SIDEBAR_ROOT_TYPE

  const { setNodeRef, isOver, active, over } = useDroppable({
    id: dropId,
    data: {
      accepts: [SIDEBAR_ITEM_TYPES.folders, SIDEBAR_ITEM_TYPES.notes],
      _id: folder ? folder._id : SIDEBAR_ROOT_TYPE,
      categoryId: targetCategoryId,
      ancestorIds,
      type: dropType,
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
