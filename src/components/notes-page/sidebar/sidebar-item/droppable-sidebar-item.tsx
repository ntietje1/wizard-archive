import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import type { Id } from 'convex/_generated/dataModel'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useFileDropZone } from '~/hooks/useFileDropZone'
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

  const isDropTarget = useSidebarUIStore((s) => {
    const id = s.sidebarDragTargetId
    if (id === null) return false
    if (id === item._id) return true
    return ancestorIds.includes(id as Id<'folders'>)
  })
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

  const dropData = { ...item, ancestorIds }

  useDroppable({ ref, data: dropData })

  const { isFileDropTarget, isDraggingFiles, fileDropProps } = useFileDropZone({
    targetId: item._id,
    canAcceptFiles: canDropFilesOnTarget(dropData),
  })

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    ancestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isDropTarget || isFileDropTarget || isFileParentValidDrop

  const isTrashAction =
    dragDropAction === 'trash' || dragDropAction === 'move-and-trash'

  const highlightClass = shouldHighlight
    ? isDropTarget && isTrashAction
      ? 'bg-drop-highlight-trash'
      : 'bg-drop-highlight'
    : 'bg-background'

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 ${highlightClass}`}
      {...fileDropProps}
    >
      {children}
    </div>
  )
}
