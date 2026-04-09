import type { LucideIcon } from 'lucide-react'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import { DEFAULT_SIDEBAR_ITEM_ICONS, getIconByName } from '~/shared/utils/category-icons'
import {
  DEFAULT_ITEM_COLOR,
  validateHexColorOrDefault,
} from '~/features/sidebar/utils/sidebar-item-utils'

export type PinDisplayData = {
  color: string | null
  iconName: string | null
  itemType: SidebarItemType | null
}

export function resolvePinIcon(pin: PinDisplayData): LucideIcon {
  if (pin.iconName) return getIconByName(pin.iconName)
  if (pin.itemType) return DEFAULT_SIDEBAR_ITEM_ICONS[pin.itemType] ?? getIconByName()
  return getIconByName()
}

export function resolvePinColor(pin: PinDisplayData): string {
  return validateHexColorOrDefault(pin.color, DEFAULT_ITEM_COLOR)
}
