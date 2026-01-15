import type { MouseEvent } from 'react'
import type { LucideIcon } from '~/lib/icons'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'

export interface SidebarItemHandlers {
  onSelect?: (e: MouseEvent) => void
  onMoreOptions?: (e: MouseEvent) => void
  onToggleExpanded?: (e: MouseEvent) => void
}

export interface SidebarItemState {
  isDragging: boolean
  isSelected: boolean
  isRenaming: boolean
  isExpanded?: boolean
}

// TODO: simplify this
export interface SidebarItemButtonProps
  extends SidebarItemHandlers,
    SidebarItemState {
  icon: LucideIcon
  name: string
  defaultName: string
  showChevron: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
  excludeId?: SidebarItemId
}
