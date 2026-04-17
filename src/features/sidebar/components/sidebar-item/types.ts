import type { MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'

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

export interface SidebarItemButtonProps extends SidebarItemHandlers, SidebarItemState {
  icon: LucideIcon
  name: SidebarItemName
  showChevron: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  excludeId?: Id<'sidebarItems'>
  shareButton?: ReactNode
}
