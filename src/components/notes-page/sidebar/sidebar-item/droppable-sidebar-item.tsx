import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import type { Id } from 'convex/_generated/dataModel'
import { canDropFilesOnTarget } from '~/lib/dnd-registry'
import { useSidebarItemDropTarget } from '~/hooks/useSidebarItemDropTarget'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
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

  const { ancestorIds } = useSidebarItemDropTarget({ ref, item })

  const isDropTarget = useSidebarUIStore((s) => {
    const id = s.sidebarDragTargetId
    if (id === null) return false
    if (id === item._id) return true
    return ancestorIds.includes(id as Id<'folders'>)
  })
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    parentId: item._id,
    canAcceptFiles: canDropFilesOnTarget(item),
  })

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    ancestorIds.includes(fileDragHoveredId)

  const shouldHighlight =
    isDropTarget || isFileDropTarget || isFileParentValidDrop

  const isTrashAction = dragDropAction === 'trash'

  const highlightClass = shouldHighlight
    ? isDropTarget && isTrashAction
      ? 'bg-drop-highlight-trash'
      : 'bg-drop-highlight'
    : 'bg-background'

  return (
    <div ref={ref} className={`w-full min-w-0 ${highlightClass}`}>
      {children}
    </div>
  )
}
