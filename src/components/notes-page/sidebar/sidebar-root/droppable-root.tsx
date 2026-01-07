import { useDroppable } from '@dnd-kit/core'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const { setNodeRef, isOver, active, over } = useDroppable({
    id: SIDEBAR_ROOT_TYPE,
    data: {
      accepts: SIDEBAR_ITEM_TYPES,
      _id: SIDEBAR_ROOT_TYPE,
      ancestorIds: [],
      type: SIDEBAR_ROOT_TYPE,
    },
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = isOver && canDrop

  const rootTargetData = {
    id: SIDEBAR_ROOT_TYPE,
    type: SIDEBAR_ROOT_TYPE,
    ancestorIds: [],
  }
  const canAcceptFileDrops = canDropFilesOnTarget(rootTargetData)
  const {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileDragDrop(undefined) // root level, so parentId is undefined

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isValidDrop && 'bg-muted',
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
