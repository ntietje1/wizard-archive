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
  iconName: v.nullable(v.string()),
  color: v.nullable(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.nullable(v.id('sidebarItems')),
  allPermissionLevel: v.nullable(permissionLevelValidator),
  location: sidebarItemLocationValidator,
  previewStorageId: v.nullable(v.id('_storage')),
  previewLockedUntil: v.nullable(v.number()),
  previewClaimToken: v.nullable(v.string()),
  previewUpdatedAt: v.nullable(v.number()),
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
    imageStorageId: v.nullable(v.id('_storage')),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  files: defineTable({
    ...extensionBaseFields,
    storageId: v.nullable(v.id('_storage')),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  canvases: defineTable({
    ...extensionBaseFields,
  }).index('by_sidebarItemId', ['sidebarItemId']),
}
