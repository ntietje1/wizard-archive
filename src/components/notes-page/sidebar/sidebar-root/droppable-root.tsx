import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types/baseTypes'
import { canDropFilesOnTarget } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
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
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  useDroppable({ ref, data: rootTargetData })

  const canAcceptFileDrops = canDropFilesOnTarget(rootTargetData)
  useExternalDropTarget({
    ref,
    parentId: undefined,
    canAcceptFiles: canAcceptFileDrops,
  })

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && 'bg-muted',
        isDraggingFiles && canAcceptFileDrops && 'bg-muted/50',
      )}
    >
      {children}
    </div>
  )
}
