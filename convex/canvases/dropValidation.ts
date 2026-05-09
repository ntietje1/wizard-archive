import { SIDEBAR_ITEM_LOCATION } from '../sidebarItems/types/baseTypes'
import type { AnySidebarItem } from '../sidebarItems/types/types'
import type { Id } from '../_generated/dataModel'

export type CanvasEmbedDropValidationCode = 'self_embed' | 'trashed_item' | 'wrong_campaign'

export function validateCanvasEmbedDropTarget({
  canvasId,
  item,
  campaignId,
}: {
  canvasId: Id<'sidebarItems'>
  item: Pick<AnySidebarItem, '_id' | 'campaignId' | 'location'>
  campaignId: Id<'campaigns'> | null
}): CanvasEmbedDropValidationCode | null {
  if (item._id === canvasId) return 'self_embed'
  if (item.location === SIDEBAR_ITEM_LOCATION.trash) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
