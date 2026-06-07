import { useRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { Folder } from 'shared/folders/types'
import { cn } from '~/features/shadcn/lib/utils'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'

interface DroppableFolderZoneProps extends HTMLAttributes<HTMLElement> {
  folder: Folder
  children: ReactNode
}

export function DroppableFolderZone({
  folder,
  children,
  className,
  onPointerDownCapture,
  onFocusCapture,
  ...props
}: DroppableFolderZoneProps) {
  const ref = useRef<HTMLElement>(null)
  const actorPermissions = useCampaignActorPermissions()
  const canDrop = actorPermissions.canMutate(folder, PERMISSION_LEVEL.FULL_ACCESS)
  const { isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget({
    ref,
    item: folder,
    canDrop,
  })
  const isNotTrashed = !folder.isTrashed

  const activeHighlight =
    isDropTarget && isTrashAction
      ? dropTargetChromeClass('destructive')
      : dropTargetChromeClass('default')

  return (
    <section
      ref={ref}
      aria-label={`${folder.name} folder contents`}
      tabIndex={-1}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={onFocusCapture}
      className={cn(
        className,
        isNotTrashed && isDropTarget && activeHighlight,
        isNotTrashed && isFileDropTarget && dropTargetChromeClass('file'),
      )}
      {...props}
    >
      {children}
    </section>
  )
}
