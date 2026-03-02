import { useRef } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types/baseTypes'
import { canDropFilesOnTarget } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'

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

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    parentId: null,
    canAcceptFiles: canDropFilesOnTarget(rootTargetData),
  })

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && !isFileDropTarget && 'bg-muted',
        isFileDropTarget && 'bg-muted/50',
      )}
    >
      {children}
    </div>
  )
}
