import { v } from 'convex/values'

export const sidebarItemIdValidator = v.union(
  v.id('notes'),
  v.id('folders'),
  v.id('gameMaps'),
  v.id('files'),
)

export const sidebarItemTypeValidator = v.union(
  v.literal('notes'),
  v.literal('folders'),
  v.literal('gameMaps'),
  v.literal('files'),
)

// Share status enum for sidebar items
// - 'all_shared': Visible to all players (no need to query sidebarItemShares)
// - 'not_shared': Visible to no players (no need to query sidebarItemShares)
// - 'individually_shared': Visible to specific players (must query sidebarItemShares)
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
  shareStatus: v.optional(sidebarItemShareStatusValidator), // Default: 'not_shared'
}
