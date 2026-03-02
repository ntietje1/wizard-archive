import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
import { useSidebarItemDropTarget } from '~/hooks/useSidebarItemDropTarget'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

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

  useSidebarItemDropTarget({ ref, item: folder })

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === folder._id,
  )
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(folder),
  })

  const isTrashAction = dragDropAction === 'trash'

  const activeHighlight =
    isDropTarget && isTrashAction
      ? 'bg-drop-highlight-trash'
      : highlightClassName

  return (
    <div
      ref={ref}
      className={cn(
        className,
        !folder.deletionTime && isDropTarget && activeHighlight,
        !folder.deletionTime && isFileDropTarget && highlightClassName,
      )}
    >
      {children}
    </div>
  )
}
