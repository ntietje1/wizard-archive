import { useRef } from 'react'
import type { FolderItem } from '../../../items'
import type { ReactNode } from 'react'
import { useSidebarItemDropTarget } from '../../../../drag-drop/use-sidebar-item-drop-target'
import {
  dropTargetBeforeRingClassName,
  dropTargetFillClassName,
} from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { DropTargetVisualState } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'

interface DroppableSidebarItemProps {
  canDrop: boolean
  children: ReactNode
  item: FolderItem
}

export function DroppableSidebarItem({ canDrop, item, children }: DroppableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { dropTargetRef, isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget(
    {
      ref,
      item,
      canDrop,
    },
  )

  const dropVisualState: DropTargetVisualState | null = isDropTarget
    ? isTrashAction
      ? 'destructive'
      : 'default'
    : isFileDropTarget
      ? 'file'
      : null
  const ringClass = dropVisualState ? dropTargetBeforeRingClassName(dropVisualState) : ''
  const bgClass = dropVisualState ? dropTargetFillClassName(dropVisualState) : ''

  return (
    <div
      ref={dropTargetRef}
      className={cn(
        'w-full min-w-0 relative',
        bgClass,
        dropVisualState &&
          'before:absolute before:inset-0 before:ring-2 before:ring-inset before:pointer-events-none before:z-10 before:rounded-[inherit]',
        ringClass,
      )}
    >
      {children}
    </div>
  )
}
