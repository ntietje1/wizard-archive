import { useEffect, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/baseTypes'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, validateDrop } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rootTargetData = { type: SIDEBAR_ROOT_TYPE }

  const rootTargetDataRef = useRef(rootTargetData)
  rootTargetDataRef.current = rootTargetData

  // Highlight only when root itself is the topmost drop target
  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === SIDEBAR_ROOT_TYPE,
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () => rootTargetDataRef.current,
      canDrop: ({ source }) => {
        const dragData = source.data as SidebarDragData
        return validateDrop(dragData, rootTargetDataRef.current).valid
      },
    })
  }, [])

  const canAcceptFileDrops = canDropFilesOnTarget(rootTargetData)
  const {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileDragDrop(undefined)

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && 'bg-muted',
        isDraggingFiles && canAcceptFileDrops && 'bg-muted/50',
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
