import type { SidebarItemId } from '../sidebarItems/types/baseTypes'
import type { Id } from '../_generated/dataModel'

export function validatePinTarget(
  mapId: Id<'sidebarItems'>,
  itemId: SidebarItemId,
  existingPinItemIds: ReadonlyArray<SidebarItemId>,
): string | null {
  if ((itemId as string) === (mapId as string)) {
    return 'Cannot pin a map to itself'
  }
  if (existingPinItemIds.includes(itemId)) {
    return 'Item is already pinned on this map'
  }
  return null
}
