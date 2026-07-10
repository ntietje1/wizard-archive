import { useRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { FolderItem } from '../../workspace/items'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useSidebarItemDropTarget } from '../../drag-drop/use-sidebar-item-drop-target'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import type { FolderViewerSource } from '../../filesystem/cards/source'

type DroppableFolderZoneSource = Pick<FolderViewerSource, 'canDropIntoFolder'>

interface DroppableFolderZoneProps extends HTMLAttributes<HTMLElement> {
  folder: FolderItem
  children: ReactNode
  source: DroppableFolderZoneSource
}

export function DroppableFolderZone({
  folder,
  children,
  className,
  source,
  onPointerDownCapture,
  onFocusCapture,
  ...props
}: DroppableFolderZoneProps) {
  const ref = useRef<HTMLElement>(null)
  const canDrop = source.canDropIntoFolder(folder)
  const { dropTargetRef, isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget(
    {
      ref,
      item: folder,
      canDrop,
    },
  )
  const isNotTrashed = !folder.isTrashed

  const activeHighlight =
    isDropTarget && isTrashAction
      ? dropTargetChromeClass('destructive')
      : dropTargetChromeClass('default')

  return (
    <section
      ref={dropTargetRef}
      {...props}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={onFocusCapture}
      className={cn(
        className,
        isNotTrashed && isDropTarget && activeHighlight,
        isNotTrashed && isFileDropTarget && dropTargetChromeClass('file'),
      )}
      aria-label={`${folder.name} folder contents`}
      tabIndex={-1}
    >
      {children}
    </section>
  )
}
