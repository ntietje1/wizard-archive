import { useDroppable } from '@dnd-kit/core'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useFileSidebar } from '~/hooks/useFileSidebar'

interface DroppableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  children: React.ReactNode
}

/**
 * Check if this item can accept files as children according to drag rules
 */
function canAcceptFiles(
  item: AnySidebarItem,
  ancestorIds: Array<SidebarItemId>,
): boolean {
  return canDropFilesOnTarget({ ...item, ancestorIds })
}

export function DroppableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DroppableSidebarItemProps) {
  const dropData = { ...item, ancestorIds }

  const { setNodeRef, isOver, active, over } = useDroppable({
    id: item._id,
    data: dropData,
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = canDrop && isOver
  const isParentValidDrop =
    canDrop && ancestorIds.includes(over?.data.current?._id)

  // Handle file drag-and-drop for items that can accept files according to drag rules
  const canAcceptFileDrops = canAcceptFiles(item, ancestorIds)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? item._id : undefined)
  const { fileDragHoveredId, isDraggingFiles } = useFileSidebar()

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === item._id

  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    ancestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isValidDrop || isParentValidDrop || isFileValidDrop || isFileParentValidDrop

  // TODO: make dropping onto a non-folder item effectively drop onto the next parent in the ancestor chain

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-0 w-full',
        shouldHighlight ? 'bg-muted' : 'bg-background',
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
