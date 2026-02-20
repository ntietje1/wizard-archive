import { useMemo, useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
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
  highlightClassName = 'bg-muted/50',
}: DroppableFolderZoneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { getAncestorSidebarItems } = useAllSidebarItems()

  const ancestorIds = useMemo(
    () => getAncestorSidebarItems(folder._id).map((item) => item._id),
    [folder._id, getAncestorSidebarItems],
  )

  const dropData = { ...folder, ancestorIds }

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === folder._id,
  )

  useDroppable({ ref, data: dropData })

  const canAcceptFileDrops = canDropFilesOnTarget(dropData)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? folder._id : undefined)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === folder._id

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && highlightClassName,
        isFileValidDrop && highlightClassName,
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
