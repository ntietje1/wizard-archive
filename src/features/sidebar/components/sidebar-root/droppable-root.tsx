import { useRef } from 'react'
import { SIDEBAR_ROOT_DROP_TYPE, canDropFilesOnTarget } from '~/features/dnd/utils/drop-target-data'
import { cn } from '~/features/shadcn/lib/utils'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rootTargetData = { type: SIDEBAR_ROOT_DROP_TYPE } as const

  const { isDropTarget } = useDndDropTarget({
    ref,
    data: rootTargetData,
    highlightId: SIDEBAR_ROOT_DROP_TYPE,
  })

  useExternalDropTarget({
    ref,
    data: rootTargetData,
    canAcceptFiles: canDropFilesOnTarget(rootTargetData),
  })

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const fileDragHoveredTargetKey = useDndStore((s) => s.fileDragHoveredTargetKey)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredTargetKey === SIDEBAR_ROOT_DROP_TYPE

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && !isFileDragTarget && dropTargetChromeClass('default'),
        isFileDragTarget && dropTargetChromeClass('file'),
      )}
    >
      {children}
    </div>
  )
}
