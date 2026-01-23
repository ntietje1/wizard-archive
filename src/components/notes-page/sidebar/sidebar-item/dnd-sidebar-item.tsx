import { memo, useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useFileSidebar } from '~/hooks/useFileSidebar'

const EMPTY_ANCESTORS: Array<SidebarItemId> = []

interface DndSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  activeDragItem: SidebarDragData | null
  isDroppable?: boolean
  className?: string
  children: React.ReactNode
}

function canAcceptFiles(
  item: AnySidebarItem,
  ancestorIds: Array<SidebarItemId>,
): boolean {
  return canDropFilesOnTarget({ ...item, ancestorIds })
}

function DndSidebarItemComponent({
  item,
  ancestorIds,
  activeDragItem,
  isDroppable = false,
  className,
  children,
}: DndSidebarItemProps) {
  const safeAncestorIds = ancestorIds ?? EMPTY_ANCESTORS

  // Shared data for drag/drop
  const dndData = useMemo(
    () => ({ ...item, ancestorIds: safeAncestorIds }),
    [item, safeAncestorIds],
  )

  // Draggable setup
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({
    id: item._id,
    data: dndData,
  })

  // Droppable setup (only for folders)
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
    over,
  } = useDroppable({
    id: item._id,
    data: dndData,
    disabled: !isDroppable || activeDragItem?._id === item._id,
  })

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    if (isDroppable) setDropRef(node)
  }

  // Drop highlighting logic (only computed if droppable)
  const canDrop = isDroppable && canDropItem(active, over)
  const isValidDrop = canDrop && isOver
  const isParentValidDrop =
    canDrop && safeAncestorIds.includes(over?.data.current?._id)

  // File drag-and-drop
  const canAcceptFileDrops =
    isDroppable && canAcceptFiles(item, safeAncestorIds)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? item._id : undefined)
  const { fileDragHoveredId, isDraggingFiles } = useFileSidebar()

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === item._id
  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    safeAncestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isDroppable &&
    (isValidDrop ||
      isParentValidDrop ||
      isFileValidDrop ||
      isFileParentValidDrop)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-full min-w-0',
        shouldHighlight ? 'bg-muted' : 'bg-background',
        className,
      )}
      {...listeners}
      {...attributes}
      onDragEnter={canAcceptFileDrops ? handleDragEnter : undefined}
      onDragOver={canAcceptFileDrops ? handleDragOver : undefined}
      onDragLeave={canAcceptFileDrops ? handleDragLeave : undefined}
      onDrop={canAcceptFileDrops ? handleDrop : undefined}
    >
      {children}
    </div>
  )
}

export const DndSidebarItem = memo(DndSidebarItemComponent)
