import { useDroppable } from '@dnd-kit/core'
import { useMemo } from 'react'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useFileSidebar } from '~/hooks/useFileSidebar'

const EMPTY_ANCESTORS: Array<SidebarItemId> = []

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
  const safeAncestorIds = ancestorIds ?? EMPTY_ANCESTORS

  const dropData = useMemo(
    () => ({ ...item, ancestorIds: safeAncestorIds }),
    [item, safeAncestorIds],
  )

  const { fileDragHoveredId, isDraggingFiles, activeDragItem } =
    useFileSidebar()

  const { setNodeRef, isOver, active, over } = useDroppable({
    id: item._id,
    data: dropData,
    disabled: activeDragItem?._id === item._id,
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = canDrop && isOver
  const isParentValidDrop =
    canDrop && safeAncestorIds.includes(over?.data.current?._id)

  // Handle file drag-and-drop for items that can accept files according to drag rules
  const canAcceptFileDrops = canAcceptFiles(item, safeAncestorIds)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? item._id : undefined)

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === item._id

  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    safeAncestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isValidDrop || isParentValidDrop || isFileValidDrop || isFileParentValidDrop

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-full min-w-0',
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
