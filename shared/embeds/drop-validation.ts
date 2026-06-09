import { isTrashedSidebarItem } from 'shared/sidebar-items/types'
import type { SidebarItemStatus } from 'shared/sidebar-items/types'

type EmbedDropValidationCode = 'self_embed' | 'trashed_item' | 'wrong_campaign'

type EmbedDropItem<TSidebarItemId extends string, TCampaignId extends string> = {
  _id: TSidebarItemId
  campaignId: TCampaignId
  status: SidebarItemStatus
}

export function validateEmbedDropTarget<TSidebarItemId extends string, TCampaignId extends string>({
  targetId,
  item,
  campaignId,
}: {
  targetId: TSidebarItemId
  item: EmbedDropItem<TSidebarItemId, TCampaignId>
  campaignId: TCampaignId | null
}): EmbedDropValidationCode | null {
  if (item._id === targetId) return 'self_embed'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
