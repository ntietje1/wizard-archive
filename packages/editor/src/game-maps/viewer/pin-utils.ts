import type { LucideIcon } from 'lucide-react'
import type { ResourceKind } from '../../workspace/resource-contract'
import { DEFAULT_SIDEBAR_ITEM_ICONS, getIconByName } from '../../workspace/sidebar/item-icons'

type PinDisplayData = {
  color: string | null
  iconName: string | null
  itemType: ResourceKind | null
}

export function resolvePinIcon(pin: PinDisplayData): LucideIcon {
  if (pin.iconName) return getIconByName(pin.iconName)
  if (pin.itemType) return DEFAULT_SIDEBAR_ITEM_ICONS[pin.itemType] ?? getIconByName()
  return getIconByName()
}
