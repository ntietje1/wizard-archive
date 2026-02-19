import { useRef } from 'react'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { useDraggable } from '~/hooks/useDraggable'

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
  const ref = useRef<HTMLDivElement>(null)

  const canDrag = hasAtLeastPermissionLevel(
    item.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )

  useDraggable({
    ref,
    data: { ...item, ancestorIds },
    canDrag,
  })

  return (
    <div className="w-full min-w-0" ref={ref}>
      {children}
    </div>
  )
}
