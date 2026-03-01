import { useRef } from 'react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useDraggable } from '~/hooks/useDraggable'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  children: React.ReactNode
}

export function DraggableSidebarItem({
  item,
  children,
}: DraggableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const canDrag = hasAtLeastPermissionLevel(
    item.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )

  useDraggable({
    ref,
    data: { sidebarItemId: item._id },
    canDrag,
  })

  return (
    <div className="w-full min-w-0" ref={ref}>
      {children}
    </div>
  )
}
