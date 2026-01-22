import { v } from 'convex/values'
import { SIDEBAR_ITEM_TYPES } from './types'

export const sidebarItemIdValidator = v.union(
  v.id('notes'),
  v.id('folders'),
  v.id('gameMaps'),
  v.id('files'),
)

export const sidebarItemTypeValidator = v.union(
  v.literal(SIDEBAR_ITEM_TYPES.notes),
  v.literal(SIDEBAR_ITEM_TYPES.folders),
  v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  v.literal(SIDEBAR_ITEM_TYPES.files),
)

export const sidebarItemShareStatusValidator = v.union(
  v.literal('all_shared'),
  v.literal('not_shared'),
  v.literal('individually_shared'),
)

export const sidebarItemBaseFields = {
  name: v.optional(v.string()),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.optional(v.string()),
  color: v.optional(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.optional(sidebarItemIdValidator),
  updatedAt: v.number(),
  shareStatus: v.optional(sidebarItemShareStatusValidator),
  isBookmarked: v.optional(v.boolean()),
}
