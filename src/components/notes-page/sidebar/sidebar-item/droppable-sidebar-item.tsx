import { useEffect, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/baseTypes'
import type { Folder } from 'convex/folders/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { canDropFilesOnTarget, validateDrop } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

const EMPTY_ANCESTORS: Array<Id<'folders'>> = []

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
  const safeAncestorIds = ancestorIds ?? EMPTY_ANCESTORS

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  // Highlight when this folder IS the target, OR an ancestor is the target,
  // OR root is the target. Boolean selector — only re-renders when value changes.
  const isDropTarget = useSidebarUIStore((s) => {
    const id = s.sidebarDragTargetId
    if (id === null) return false
    if (id === item._id) return true
    if (id === SIDEBAR_ROOT_TYPE) return true
    return safeAncestorIds.includes(id as Id<'folders'>)
  })

  // Store mutable data in ref so useEffect doesn't re-run on data changes
  const dropDataRef = useRef<SidebarDropData>({
    ...item,
    ancestorIds: safeAncestorIds,
  })
  dropDataRef.current = { ...item, ancestorIds: safeAncestorIds }

  // Register as drop target — only re-register when item ID changes
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
  }, [item._id])

  // Handle file drag-and-drop
  const canAcceptFileDrops = canDropFilesOnTarget(dropDataRef.current)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? item._id : undefined)

  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === item._id

  const isFileParentValidDrop =
    isDraggingFiles &&
    fileDragHoveredId !== null &&
    safeAncestorIds.includes(fileDragHoveredId)

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
