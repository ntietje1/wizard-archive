import { useDroppable } from '@dnd-kit/core'
import { validSidebarChildren } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'

interface DroppableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  children: React.ReactNode
}

function getDropData(item: AnySidebarItem, ancestorIds: Array<SidebarItemId>) {
  const accepts = validSidebarChildren[item.type]

  return {
    accepts,
    _id: item._id,
    categoryId: item.categoryId,
    ancestorIds,
    type: item.type,
  }
}

/**
 * Check if this item can accept files as children according to drag rules
 */
function canAcceptFiles(
  item: AnySidebarItem,
  ancestorIds: Array<SidebarItemId>,
): boolean {
  const targetData = {
    id: item._id,
    type: item.type,
    categoryId: item.categoryId,
    ancestorIds,
  }
  return canDropFilesOnTarget(targetData)
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

  // Handle file drag-and-drop for items that can accept files according to drag rules
  const canAcceptFileDrops = canAcceptFiles(item, ancestorIds)
  const {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileDragDrop(canAcceptFileDrops ? item._id : undefined)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-colors min-w-0 w-full',
        isValidDrop ? 'bg-muted' : 'bg-background',
        isDraggingFiles && canAcceptFileDrops && 'bg-muted/50',
      )}
      onDragEnter={canAcceptFileDrops ? handleDragEnter : undefined}
      onDragOver={canAcceptFileDrops ? handleDragOver : undefined}
      onDragLeave={canAcceptFileDrops ? handleDragLeave : undefined}
      onDrop={canAcceptFileDrops ? handleDrop : undefined}
    >
      {children}
    </div>
  )
}
