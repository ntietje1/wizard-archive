import { useRef } from 'react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/features/dnd/utils/dnd-registry'
import { cn } from '~/features/shadcn/lib/utils'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

interface DroppableFolderZoneProps {
  folder: Folder
  children: React.ReactNode
  className?: string
}

export function DroppableFolderZone({ folder, children, className }: DroppableFolderZoneProps) {
  const ref = useRef<HTMLDivElement>(null)

  useSidebarItemDropTarget({ ref, item: folder })

  const isDropTarget = useDndStore((s) => s.sidebarDragTargetId === folder._id)
  const isTrashAction = useDndStore(
    (s) => s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(folder),
  })

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useDndStore((s) => s.fileDragHoveredId)
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
        folder.location !== SIDEBAR_ITEM_LOCATION.trash && isDropTarget && activeHighlight,
        folder.location !== SIDEBAR_ITEM_LOCATION.trash &&
          isFileDragTarget &&
          'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {children}
    </div>
  )
}
