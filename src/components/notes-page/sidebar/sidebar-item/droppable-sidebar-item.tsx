import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/baseTypes'
import type { Folder } from 'convex/folders/types'
import type { Id } from 'convex/_generated/dataModel'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableSidebarItemProps {
  item: Folder
  ancestorIds?: Array<Id<'folders'>>
  children: React.ReactNode
}

export function DroppableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DroppableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const isDropTarget = useSidebarUIStore((s) => {
    const id = s.sidebarDragTargetId
    if (id === null) return false
    if (id === item._id) return true
    if (id === SIDEBAR_ROOT_TYPE) return true
    return ancestorIds.includes(id as Id<'folders'>)
  })

  const dropData = { ...item, ancestorIds }

  useDroppable({ ref, data: dropData })

  const canAcceptFileDrops = canDropFilesOnTarget(dropData)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? item._id : undefined)

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === item._id

  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    ancestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isDropTarget || isFileValidDrop || isFileParentValidDrop

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 ${shouldHighlight ? 'bg-muted' : 'bg-background'}`}
      onDragEnter={canAcceptFileDrops ? handleDragEnter : undefined}
      onDragOver={canAcceptFileDrops ? handleDragOver : undefined}
      onDragLeave={canAcceptFileDrops ? handleDragLeave : undefined}
      onDrop={canAcceptFileDrops ? handleDrop : undefined}
    >
      {children}
    </div>
  )
}
