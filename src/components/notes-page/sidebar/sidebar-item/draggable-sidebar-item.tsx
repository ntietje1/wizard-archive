import { useDraggable } from '@dnd-kit/core'
import { useMemo } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { cn } from '~/lib/shadcn/utils'

const EMPTY_ANCESTORS: Array<Id<'folders'>> = []

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<Id<'folders'>>
  children: React.ReactNode
}

export function DraggableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DraggableSidebarItemProps) {
  const safeAncestorIds = ancestorIds ?? EMPTY_ANCESTORS

  const dragData = useMemo(
    () => ({ ...item, ancestorIds: safeAncestorIds }),
    [item, safeAncestorIds],
  )

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: item._id,
    data: dragData,
  })

  return (
    <div
      className={cn('w-full min-w-0')}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}
