import type { Id } from '../_generated/dataModel'
import { isSidebarItemTrashed } from '../sidebarItems/functions/sidebarItemLifecycle'
import type { AnySidebarItem } from '../sidebarItems/types/types'

export type PinDropValidationCode =
  | 'self_pin'
  | 'already_pinned'
  | 'trashed_item'
  | 'wrong_campaign'

export function validatePinTarget(
  mapId: Id<'sidebarItems'>,
  itemId: Id<'sidebarItems'>,
  existingPinItemIds: ReadonlyArray<Id<'sidebarItems'>>,
): string | null {
  if (itemId === mapId) {
    return 'Cannot pin a map to itself'
  }
  if (existingPinItemIds.includes(itemId)) {
    return 'Item is already pinned on this map'
  }
  return null
}

export function validatePinDropTarget({
  mapId,
  item,
  existingPinItemIds,
  campaignId,
}: {
  mapId: Id<'sidebarItems'>
  item: Pick<AnySidebarItem, '_id' | 'campaignId' | 'location' | 'status'>
  existingPinItemIds: ReadonlyArray<Id<'sidebarItems'>>
  campaignId: Id<'campaigns'> | null
}): PinDropValidationCode | null {
  if (item._id === mapId) return 'self_pin'
  if (existingPinItemIds.includes(item._id)) return 'already_pinned'
  if (isSidebarItemTrashed(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
