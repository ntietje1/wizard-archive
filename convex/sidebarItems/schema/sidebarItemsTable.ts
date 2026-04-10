import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields } from '../../common/schema'
import {
  permissionLevelValidator,
  sidebarItemLocationValidator,
  sidebarItemTypeValidator,
} from './baseValidators'

const sidebarItemTableFields = {
  name: v.string(),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.union(v.string(), v.null()),
  color: v.union(v.string(), v.null()),
  type: sidebarItemTypeValidator,
  parentId: v.union(v.id('sidebarItems'), v.null()),
  allPermissionLevel: v.union(permissionLevelValidator, v.null()),
  location: sidebarItemLocationValidator,
  previewStorageId: v.union(v.id('_storage'), v.null()),
  previewLockedUntil: v.union(v.number(), v.null()),
  previewClaimToken: v.union(v.string(), v.null()),
  previewUpdatedAt: v.union(v.number(), v.null()),
  ...commonTableFields,
}

const extensionBaseFields = {
  sidebarItemId: v.id('sidebarItems'),
  ...commonTableFields,
}

export const sidebarItemsTables = {
  sidebarItems: defineTable(sidebarItemTableFields)
    .index('by_campaign_location_parent_name', ['campaignId', 'location', 'parentId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug'])
    .index('by_campaign_deletionTime', ['campaignId', 'deletionTime'])
    .index('by_campaign_type', ['campaignId', 'type']),

  notes: defineTable({
    ...extensionBaseFields,
  }).index('by_sidebarItemId', ['sidebarItemId']),

  folders: defineTable({
    ...extensionBaseFields,
    inheritShares: v.boolean(),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  gameMaps: defineTable({
    ...extensionBaseFields,
    imageStorageId: v.union(v.id('_storage'), v.null()),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  files: defineTable({
    ...extensionBaseFields,
    storageId: v.union(v.id('_storage'), v.null()),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  canvases: defineTable({
    ...extensionBaseFields,
  }).index('by_sidebarItemId', ['sidebarItemId']),
}
