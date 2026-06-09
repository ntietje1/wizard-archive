import { ArrowUpLeft, ArrowUpRight, History, List } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import { getRightSidebarContentItemTypes } from './right-sidebar-model'
import type { LucideIcon } from 'lucide-react'
import type { RightSidebarItemType } from './right-sidebar-model'

interface RightSidebarPanelDefinition {
  id: RightSidebarContentId
  label: string
  icon: LucideIcon
  appliesTo: ReadonlyArray<RightSidebarItemType>
}

export const RIGHT_SIDEBAR_PANELS: Array<RightSidebarPanelDefinition> = [
  {
    id: RIGHT_SIDEBAR_CONTENT.history,
    label: 'History',
    icon: History,
    appliesTo: getRightSidebarContentItemTypes(RIGHT_SIDEBAR_CONTENT.history),
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.backlinks,
    label: 'Back Links',
    icon: ArrowUpLeft,
    appliesTo: getRightSidebarContentItemTypes(RIGHT_SIDEBAR_CONTENT.backlinks),
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.outgoing,
    label: 'Outgoing Links',
    icon: ArrowUpRight,
    appliesTo: getRightSidebarContentItemTypes(RIGHT_SIDEBAR_CONTENT.outgoing),
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.outline,
    label: 'Outline',
    icon: List,
    appliesTo: getRightSidebarContentItemTypes(RIGHT_SIDEBAR_CONTENT.outline),
  },
] as const

export function getRightSidebarPanelsForItemType(itemType: RightSidebarItemType) {
  return RIGHT_SIDEBAR_PANELS.filter((panel) => panel.appliesTo.includes(itemType))
}
