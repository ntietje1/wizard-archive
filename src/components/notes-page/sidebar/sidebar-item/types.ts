import type { MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from '~/lib/icons'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { EditorLinkProps } from '~/hooks/useEditorLinkProps'

export interface SidebarItemHandlers {
  linkProps?: EditorLinkProps
  onClick?: (e: MouseEvent) => void
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
  showChevron: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'>
  excludeId?: SidebarItemId
  shareButton?: ReactNode
}
