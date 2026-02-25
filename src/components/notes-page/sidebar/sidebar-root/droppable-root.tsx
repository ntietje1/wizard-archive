import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types/baseTypes'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rootTargetData = { type: SIDEBAR_ROOT_TYPE } as const

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === SIDEBAR_ROOT_TYPE,
  )

  useDroppable({ ref, data: rootTargetData })

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
