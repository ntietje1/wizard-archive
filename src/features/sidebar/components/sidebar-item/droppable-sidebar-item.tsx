import { useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'

interface DroppableSidebarItemProps {
  item: Folder
  children: React.ReactNode
}

export function DroppableSidebarItem({ item, children }: DroppableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget({ ref, item })

  const isHighlighted = isDropTarget || isFileDropTarget
  const ringClass = isDropTarget
    ? isTrashAction
      ? 'before:ring-destructive/60'
      : 'before:ring-ring/60'
    : isFileDropTarget
      ? 'before:ring-ring/40'
      : ''
  const bgClass = isDropTarget
    ? isTrashAction
      ? 'bg-destructive/5'
      : 'bg-ring/5'
    : isFileDropTarget
      ? 'bg-ring/5'
      : ''

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 relative ${bgClass} ${isHighlighted ? `before:absolute before:inset-0 before:ring-2 before:ring-inset before:pointer-events-none before:z-10 before:rounded-[inherit] ${ringClass}` : ''}`}
    >
      {children}
    </div>
  )
}
