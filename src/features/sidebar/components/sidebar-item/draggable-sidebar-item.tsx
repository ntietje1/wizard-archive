import { useRef } from 'react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  children: React.ReactNode
}

export function DraggableSidebarItem({ item, children }: DraggableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const canDrag = hasAtLeastPermissionLevel(item.myPermissionLevel, PERMISSION_LEVEL.FULL_ACCESS)
  const dragData = useSidebarDragData(item)

  useDraggable({
    ref,
    data: dragData,
    canDrag,
  })

  return (
    <div className="w-full min-w-0" ref={ref}>
      {children}
    </div>
  )
}
