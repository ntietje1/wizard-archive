import { useDroppable } from '@dnd-kit/core'
import { cn } from '~/lib/utils'
import { RootContextMenu } from './root-context-menu'
import { SIDEBAR_ITEM_TYPES, SIDEBAR_ROOT_TYPE } from 'convex/notes/types'
import { canDropItem } from '../dnd-utils'

interface DroppableRootProps {
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ children, className }: DroppableRootProps) {
  const { setNodeRef, isOver, active, over } = useDroppable({
    id: SIDEBAR_ROOT_TYPE,
    data: {
      accepts: [SIDEBAR_ITEM_TYPES.folders, SIDEBAR_ITEM_TYPES.notes],
      _id: SIDEBAR_ROOT_TYPE,
      categoryId: undefined,
      ancestorIds: [],
      type: SIDEBAR_ROOT_TYPE,
    },
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = isOver && canDrop

  return (
    <div ref={setNodeRef} className={cn(className, isValidDrop && 'bg-muted')}>
      <RootContextMenu className="flex flex-col flex-1">
        {children}
      </RootContextMenu>
    </div>
  )
}
