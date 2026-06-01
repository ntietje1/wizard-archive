import { isTrashedSidebarItem } from '../sidebar-items/types'

type PinDropValidationCode = 'self_pin' | 'already_pinned' | 'trashed_item' | 'wrong_campaign'

type PinDropValidationItem<TItemId extends string, TCampaignId extends string> = {
  _id: TItemId
  campaignId: TCampaignId
  status: Parameters<typeof isTrashedSidebarItem>[0]['status']
}

export function validatePinTarget<TItemId extends string>(
  mapId: TItemId,
  itemId: TItemId,
  existingPinItemIds: ReadonlyArray<TItemId>,
): string | null {
  if (itemId === mapId) {
    return 'Cannot pin a map to itself'
  }
  if (existingPinItemIds.includes(itemId)) {
    return 'Item is already pinned on this map'
  }
  return null
}

export function validatePinDropTarget<TItemId extends string, TCampaignId extends string>({
  mapId,
  item,
  existingPinItemIds,
  campaignId,
}: {
  mapId: TItemId
  item: PinDropValidationItem<TItemId, TCampaignId>
  existingPinItemIds: ReadonlyArray<TItemId>
  campaignId: TCampaignId | null
}): PinDropValidationCode | null {
  if (item._id === mapId) return 'self_pin'
  if (existingPinItemIds.includes(item._id)) return 'already_pinned'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
