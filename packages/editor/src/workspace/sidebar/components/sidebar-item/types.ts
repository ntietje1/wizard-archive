import type { ResourceId } from '../../../../resources/domain-id'
import type { MouseEvent, ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ResourceTitle } from '../../../../resources/resource-contract'

import type { SidebarItemVisualState } from '../../item-visual-state'

interface SidebarItemHandlers {
  onClick?: (e: MouseEvent) => void
  onContextMenu?: (e: MouseEvent) => void
  onMoreOptions?: (e: MouseEvent) => void
  onToggleExpanded?: (e: MouseEvent) => void
}

interface SidebarItemPresentation {
  visualState: SidebarItemVisualState
  renaming: boolean
  expanded: boolean
  showChevron: boolean
  pending?: boolean
  indentLevel?: number
}

export interface SidebarItemButtonProps extends SidebarItemHandlers {
  icon: LucideIcon
  itemId: ResourceId
  name: ResourceTitle
  nameContent?: ReactNode
  presentation: SidebarItemPresentation
  shareButton?: ReactNode
  rowRef?: Ref<HTMLDivElement>
}
