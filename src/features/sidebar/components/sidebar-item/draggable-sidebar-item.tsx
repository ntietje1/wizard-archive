import { useRef } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { hasAtLeastPermissionLevel } from 'shared/permissions/hasAtLeastPermissionLevel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  children: React.ReactNode
  disabled?: boolean
}

export function DraggableSidebarItem({
  item,
  children,
  disabled = false,
}: DraggableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const canDrag = hasAtLeastPermissionLevel(item.myPermissionLevel, PERMISSION_LEVEL.FULL_ACCESS)
  const dragData = useSidebarDragData(item)
  const isDragging = useDndStore((state) => state.sidebarDragPreviewItemIds.includes(item._id))

  useDraggable({
    ref,
    data: dragData,
    canDrag: canDrag && !disabled,
  })

  return (
    <div className={cn('w-full min-w-0', isDragging && 'opacity-50')} ref={ref}>
      {children}
    </div>
  )
}
