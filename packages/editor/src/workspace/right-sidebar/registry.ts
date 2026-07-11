import { ArrowUpLeft, ArrowUpRight, History, List } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './content'
import type { RightSidebarContentId } from './content'
import { getRightSidebarContentItemTypes } from './model'
import type { LucideIcon } from 'lucide-react'
import type { RightSidebarAvailablePanels } from './source'
import type { ResourceKind } from '../resource-contract'

interface RightSidebarPanelDefinition {
  id: RightSidebarContentId
  label: string
  icon: LucideIcon
  appliesTo: ReadonlyArray<ResourceKind>
}

export const RIGHT_SIDEBAR_PANELS: ReadonlyArray<RightSidebarPanelDefinition> = [
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

function getRightSidebarPanelsForItemType(itemType: ResourceKind) {
  return RIGHT_SIDEBAR_PANELS.filter((panel) => panel.appliesTo.includes(itemType))
}

export function getAvailableRightSidebarPanelsForItemType(
  itemType: ResourceKind,
  availablePanels: RightSidebarAvailablePanels,
) {
  return getRightSidebarPanelsForItemType(itemType).filter((panel) => availablePanels[panel.id])
}

export function resolveAvailableRightSidebarContentForItemType(
  itemType: ResourceKind | null | undefined,
  contentId: RightSidebarContentId | null | undefined,
  availablePanels: RightSidebarAvailablePanels,
): RightSidebarContentId | null {
  if (!itemType) return null

  const panels = getAvailableRightSidebarPanelsForItemType(itemType, availablePanels)
  const requestedPanel = panels.find((panel) => panel.id === contentId)
  return requestedPanel?.id ?? panels[0]?.id ?? null
}
