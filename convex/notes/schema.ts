import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  commonSidebarItemTableFields,
  commonSidebarItemValidatorFields,
} from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { permissionLevelValidator } from '../sidebarItems/schema/baseValidators'
import { blockShareStatusValidator } from '../blocks/schema'
import { folderValidator } from '../folders/baseSchema'

const noteTableFields = {
  ...commonSidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.notes),
  lastThumbnailUpdate: v.optional(v.number()),
  thumbnailGenerationLock: v.optional(v.number()),
}

export const notesTables = {
  notes: defineTable({
    ...noteTableFields,
  })
    .index('by_campaign_location_parent_name', [
      'campaignId',
      'location',
      'parentId',
      'name',
    ])
    .index('by_campaign_slug', ['campaignId', 'slug'])
    .index('by_campaign_deletionTime', ['campaignId', 'deletionTime']),
}

const noteValidatorFields = {
  ...commonValidatorFields('notes'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.notes),
  lastThumbnailUpdate: v.optional(v.number()),
  thumbnailGenerationLock: v.optional(v.number()),
}

export const noteValidator = v.object(noteValidatorFields)

const blockMetaValidator = v.object({
  myPermissionLevel: permissionLevelValidator,
  shareStatus: blockShareStatusValidator,
  sharedWith: v.array(v.id('campaignMembers')),
})

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(v.any()),
  blockMeta: v.record(v.string(), blockMetaValidator),
  ancestors: v.array(folderValidator),
})
