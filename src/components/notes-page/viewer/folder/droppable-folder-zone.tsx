import { useEffect, useMemo, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Folder } from 'convex/folders/types'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { canDropFilesOnTarget, validateDrop } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { cn } from '~/lib/shadcn/utils'
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

  // Memoize ancestor computation — only recompute when folder ID or ancestor function changes
  const ancestorIds = useMemo(
    () => getAncestorSidebarItems(folder._id).map((item) => item._id),
    [folder._id, getAncestorSidebarItems],
  )

  // Store mutable data in refs so the useEffect doesn't need to re-run
  const dropDataRef = useRef<SidebarDropData>({ ...folder, ancestorIds })
  dropDataRef.current = { ...folder, ancestorIds }

  // Highlight when this folder is the drag target
  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === folder._id,
  )

  // Only re-register when the folder ID changes (not on every render)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () =>
        dropDataRef.current as unknown as Record<string, unknown>,
      canDrop: ({ source }) => {
        const dragData = source.data as unknown as SidebarDragData
        return validateDrop(dragData, dropDataRef.current).valid
      },
    })
  }, [folder._id])

  // Handle native file drag-and-drop
  const canAcceptFileDrops = canDropFilesOnTarget(dropDataRef.current)
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
