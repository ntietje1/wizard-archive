import { isTrashedSidebarItem } from 'shared/sidebar-items/types'
import type { SidebarItemStatus } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'

type CanvasEmbedDropValidationCode = 'self_embed' | 'trashed_item' | 'wrong_campaign'

type CanvasEmbedDropItem = {
  _id: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  status: SidebarItemStatus
}

export function validateCanvasEmbedDropTarget({
  canvasId,
  item,
  campaignId,
}: {
  canvasId: Id<'sidebarItems'>
  item: CanvasEmbedDropItem
  campaignId: Id<'campaigns'> | null
}): CanvasEmbedDropValidationCode | null {
  if (item._id === canvasId) return 'self_embed'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
