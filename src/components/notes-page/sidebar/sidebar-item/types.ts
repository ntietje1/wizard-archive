import type { MouseEvent } from 'react'
import type { LucideIcon } from '~/lib/icons'

export interface SidebarItemHandlers {
  onSelect?: (e: MouseEvent) => void
  onMoreOptions?: (e: MouseEvent) => void
  onToggleExpanded?: (e: MouseEvent) => void
}

export interface SidebarItemState {
  isSelected: boolean
  isRenaming: boolean
  isExpanded?: boolean
}

export interface SidebarItemButtonProps
  extends SidebarItemHandlers,
    SidebarItemState {
  icon: LucideIcon
  name: string
  defaultName: string
  showChevron?: boolean
  onFinishRename?: (name: string) => void
}
