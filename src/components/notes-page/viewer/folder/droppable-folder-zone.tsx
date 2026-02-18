import { useDroppable } from '@dnd-kit/core'
import type { Folder } from 'convex/folders/types'
import type { SidebarDropData } from '~/lib/dnd-utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { cn } from '~/lib/shadcn/utils'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

interface DroppableFolderZoneProps {
  folder: Folder
  children: React.ReactNode
  className?: string
  highlightClassName?: string
}

export function DroppableFolderZone({
  folder,
  children,
  className,
  highlightClassName = 'bg-muted',
}: DroppableFolderZoneProps) {
  const activeDragItem = useSidebarUIStore((s) => s.activeDragItem)
  const { getAncestorSidebarItems } = useAllSidebarItems()
  const ancestorItems = getAncestorSidebarItems(folder._id)
  const ancestorIds = ancestorItems.map((item) => item._id)

  const dropData: SidebarDropData = { ...folder, ancestorIds }

  const { setNodeRef, isOver, active, over } = useDroppable({
    id: `folder-zone-${folder._id}`,
    data: dropData,
    disabled: activeDragItem?._id === folder._id,
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = canDrop && isOver

  // Handle native file drag-and-drop
  const canAcceptFileDrops = canDropFilesOnTarget(dropData)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? folder._id : undefined)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === folder._id

  const shouldHighlight = isValidDrop || isFileValidDrop

  return (
    <div
      ref={setNodeRef}
      className={cn(className, shouldHighlight && highlightClassName)}
      onDragEnter={canAcceptFileDrops ? handleDragEnter : undefined}
      onDragOver={canAcceptFileDrops ? handleDragOver : undefined}
      onDragLeave={canAcceptFileDrops ? handleDragLeave : undefined}
      onDrop={canAcceptFileDrops ? handleDrop : undefined}
    >
      {children}
    </div>
  )
}
