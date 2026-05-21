import type { LucideIcon } from 'lucide-react'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import { DEFAULT_SIDEBAR_ITEM_ICONS, getIconByName } from '~/shared/utils/category-icons'

type PinDisplayData = {
  color: string | null
  iconName: string | null
  itemType: SidebarItemType | null
}

export function resolvePinIcon(pin: PinDisplayData): LucideIcon {
  if (pin.iconName) return getIconByName(pin.iconName)
  if (pin.itemType) return DEFAULT_SIDEBAR_ITEM_ICONS[pin.itemType] ?? getIconByName()
  return getIconByName()
}
