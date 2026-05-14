import type { MouseEvent, ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import type { SidebarItemVisualState } from '~/features/sidebar/utils/sidebar-item-visual-state'

interface SidebarItemHandlers {
  linkProps?: EditorLinkProps
  onClick?: (e: MouseEvent) => void
  onContextMenu?: (e: MouseEvent) => void
  onMoreOptions?: (e: MouseEvent) => void
  onToggleExpanded?: (e: MouseEvent) => void
}

interface SidebarItemPresentation {
  visualState: SidebarItemVisualState
  focused: boolean
  renaming: boolean
  expanded: boolean
  showChevron: boolean
  pending?: boolean
  indentLevel?: number
}

export interface SidebarItemButtonProps extends SidebarItemHandlers {
  icon: LucideIcon
  name: SidebarItemName
  presentation: SidebarItemPresentation
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  excludeId?: Id<'sidebarItems'>
  shareButton?: ReactNode
  rowRef?: Ref<HTMLDivElement>
}
