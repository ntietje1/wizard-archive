import { useMemo, useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableSidebarItemProps {
  item: Folder
  children: React.ReactNode
}

export function DroppableSidebarItem({
  item,
  children,
}: DroppableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { getAncestorSidebarItems } = useAllSidebarItems()
  const ancestorIds = useMemo(
    () => getAncestorSidebarItems(item._id).map((a) => a._id),
    [item._id, getAncestorSidebarItems],
  )

  const isDropTarget = useSidebarUIStore((s) => {
    const id = s.sidebarDragTargetId
    if (id === null) return false
    if (id === item._id) return true
    return ancestorIds.includes(id as Folder['_id'])
  })
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const dropData = { ...item, ancestorIds }

  useDroppable({ ref, data: dropData })

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    parentId: item._id,
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
    >
      {children}
    </div>
  )
}
