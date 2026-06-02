import { isTrashedSidebarItem } from '../sidebar-items/types'
import type { SidebarItemLocation, SidebarItemStatus } from '../sidebar-items/types'

type NoteLinkDropValidationCode = 'self_link' | 'trashed_item' | 'wrong_campaign'

export function validateNoteLinkDropTarget<
  TSidebarItemId extends string,
  TCampaignId extends string,
>({
  noteId,
  item,
  campaignId,
}: {
  noteId: TSidebarItemId
  item: {
    _id: TSidebarItemId
    campaignId: TCampaignId
    location: SidebarItemLocation
    status: SidebarItemStatus
  }
  campaignId: TCampaignId | null
}): NoteLinkDropValidationCode | null {
  if (item._id === noteId) return 'self_link'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
