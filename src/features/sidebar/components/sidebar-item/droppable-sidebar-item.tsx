import { useRef } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { Folder } from 'shared/folders/types'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'
import {
  dropTargetBeforeRingClassName,
  dropTargetFillClassName,
} from '~/features/dnd/utils/drop-target-visual-state'
import type { DropTargetVisualState } from '~/features/dnd/utils/drop-target-visual-state'

interface DroppableSidebarItemProps {
  item: Folder
  children: React.ReactNode
}

export function DroppableSidebarItem({ item, children }: DroppableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const actorPermissions = useCampaignActorPermissions()
  const { isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget({
    ref,
    item,
    canDrop: actorPermissions.canMutate(item, PERMISSION_LEVEL.FULL_ACCESS),
  })

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
      ref={ref}
      className={`w-full min-w-0 relative ${bgClass} ${dropVisualState ? `before:absolute before:inset-0 before:ring-2 before:ring-inset before:pointer-events-none before:z-10 before:rounded-[inherit] ${ringClass}` : ''}`}
    >
      {children}
    </div>
  )
}
