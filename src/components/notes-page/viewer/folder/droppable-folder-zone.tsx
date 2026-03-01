import { useMemo, useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
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
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

  useDroppable({ ref, data: dropData })

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(dropData),
  })

  const isTrashAction =
    dragDropAction === 'trash' || dragDropAction === 'move-and-trash'

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
