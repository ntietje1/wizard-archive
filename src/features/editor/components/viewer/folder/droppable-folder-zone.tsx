import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/features/dnd/utils/dnd-registry'
import { cn } from '~/features/shadcn/lib/utils'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableFolderZoneProps {
  folder: Folder
  children: React.ReactNode
  className?: string
}

export function DroppableFolderZone({
  folder,
  children,
  className,
}: DroppableFolderZoneProps) {
  const ref = useRef<HTMLDivElement>(null)

  useSidebarItemDropTarget({ ref, item: folder })

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === folder._id,
  )
  const isTrashAction = useSidebarUIStore(
    (s) =>
      s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(folder),
  })

  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === folder._id

  const activeHighlight =
    isDropTarget && isTrashAction
      ? 'ring-2 ring-inset ring-destructive/60 bg-destructive/5'
      : 'ring-2 ring-inset ring-ring/60 bg-ring/5'

  return (
    <div
      ref={ref}
      className={cn(
        className,
        !folder.deletionTime && isDropTarget && activeHighlight,
        !folder.deletionTime &&
          isFileDragTarget &&
          'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {children}
    </div>
  )
}
