import { isTrashedSidebarItem } from '../sidebarItems/types/status'
import type { AnySidebarItem } from '../sidebarItems/types/types'
import type { Id } from '../_generated/dataModel'

export type NoteLinkDropValidationCode = 'self_link' | 'trashed_item' | 'wrong_campaign'

/**
 * Validates whether a sidebar item can be linked from a note drop target.
 * Returns null when the drop is valid, otherwise returns self_link for linking
 * the note to itself, trashed_item for deleted sources, or wrong_campaign for
 * cross-campaign items.
 */
export function validateNoteLinkDropTarget({
  noteId,
  item,
  campaignId,
}: {
  noteId: Id<'sidebarItems'>
  item: Pick<AnySidebarItem, '_id' | 'campaignId' | 'location' | 'status'>
  campaignId: Id<'campaigns'> | null
}): NoteLinkDropValidationCode | null {
  if (item._id === noteId) return 'self_link'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (campaignId && item.campaignId !== campaignId) return 'wrong_campaign'
  return null
}
