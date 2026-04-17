import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  permissionLevelValidator,
  sidebarItemLocationValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
  sidebarItemTypeValidator,
} from './validators'
import { sidebarItemShareValidator } from '../../sidebarShares/schema'
import { convexValidatorFields } from '../../common/schema'

const sidebarItemTableFields = {
  name: sidebarItemNameValidator,
  slug: sidebarItemSlugValidator,
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
  updatedTime: v.nullable(v.number()),
  updatedBy: v.nullable(v.id('userProfiles')),
  createdBy: v.id('userProfiles'),
  deletionTime: v.nullable(v.number()),
  deletedBy: v.nullable(v.id('userProfiles')),
}

export const sidebarItemValidatorFields = {
  ...convexValidatorFields('sidebarItems'),
  ...sidebarItemTableFields,
  shares: v.array(sidebarItemShareValidator),
  isBookmarked: v.boolean(),
  myPermissionLevel: permissionLevelValidator,
  previewUrl: v.nullable(v.string()),
}

const extensionBaseFields = {
  sidebarItemId: v.id('sidebarItems'),
}

export const sidebarItemsTables = {
  sidebarItems: defineTable(sidebarItemTableFields)
    .index('by_campaign_location_parent_name', [
      'campaignId',
      'location',
      'parentId',
      'name',
      'deletionTime',
    ])
    .index('by_campaign_slug', ['campaignId', 'slug', 'deletionTime'])
    .index('by_campaign', ['campaignId', 'deletionTime']),

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
