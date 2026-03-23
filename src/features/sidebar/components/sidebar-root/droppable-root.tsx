import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types/baseTypes'
import { canDropFilesOnTarget } from '~/features/dnd/utils/dnd-registry'
import { cn } from '~/features/shadcn/lib/utils'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

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

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useDndStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === null

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget &&
          !isFileDragTarget &&
          'ring-2 ring-inset ring-ring/60 bg-ring/5',
        isFileDragTarget && 'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {children}
    </div>
  )
}
