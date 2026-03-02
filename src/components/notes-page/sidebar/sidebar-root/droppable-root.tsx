import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types/baseTypes'
import { canDropFilesOnTarget } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rootTargetData = { type: SIDEBAR_ROOT_TYPE } as const

  const { isDropTarget } = useDndDropTarget({
    ref,
    data: rootTargetData,
    highlightId: SIDEBAR_ROOT_TYPE,
  })

  useExternalDropTarget({
    ref,
    parentId: null,
    canAcceptFiles: canDropFilesOnTarget(rootTargetData),
  })

  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === null

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && !isFileDragTarget && 'bg-muted',
        isFileDragTarget && 'bg-muted/50',
      )}
    >
      {children}
    </div>
  )
}
