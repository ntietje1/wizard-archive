import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/features/dnd/utils/dnd-registry'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
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

  useSidebarItemDropTarget({ ref, item })

  const isDirectTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === item._id,
  )
  const isTrashAction = useSidebarUIStore(
    (s) =>
      s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  useExternalDropTarget({
    ref,
    parentId: item._id,
    canAcceptFiles: canDropFilesOnTarget(item),
  })

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileDirectTarget = isDraggingFiles && fileDragHoveredId === item._id

  const isHighlighted = isDirectTarget || isFileDirectTarget
  const ringClass = isDirectTarget
    ? isTrashAction
      ? 'before:ring-destructive/60'
      : 'before:ring-ring/60'
    : isFileDirectTarget
      ? 'before:ring-ring/40'
      : ''
  const bgClass = isDirectTarget
    ? isTrashAction
      ? 'bg-destructive/5'
      : 'bg-ring/5'
    : isFileDirectTarget
      ? 'bg-ring/5'
      : ''

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 relative ${bgClass} ${isHighlighted ? `before:absolute before:inset-0 before:ring-2 before:ring-inset before:pointer-events-none before:z-10 before:rounded-[inherit] ${ringClass}` : ''}`}
    >
      {children}
    </div>
  )
}
