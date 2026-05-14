import { useRef } from 'react'
import type { FocusEventHandler, PointerEventHandler, ReactNode } from 'react'
import type { Folder } from 'convex/folders/types'
import { cn } from '~/features/shadcn/lib/utils'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'

interface DroppableFolderZoneProps {
  folder: Folder
  children: ReactNode
  className?: string
  onPointerDownCapture?: PointerEventHandler<HTMLDivElement>
  onFocusCapture?: FocusEventHandler<HTMLDivElement>
}

export function DroppableFolderZone({
  folder,
  children,
  className,
  onPointerDownCapture,
  onFocusCapture,
}: DroppableFolderZoneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget({
    ref,
    item: folder,
  })
  const isNotTrashed = !folder.isTrashed

  const activeHighlight =
    isDropTarget && isTrashAction
      ? 'ring-2 ring-inset ring-destructive/60 bg-destructive/5'
      : 'ring-2 ring-inset ring-ring/60 bg-ring/5'

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${folder.name} folder contents`}
      tabIndex={-1}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={onFocusCapture}
      className={cn(
        className,
        isNotTrashed && isDropTarget && activeHighlight,
        isNotTrashed && isFileDropTarget && 'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {children}
    </div>
  )
}
