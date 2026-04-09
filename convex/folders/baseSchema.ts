import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  commonSidebarItemTableFields,
  commonSidebarItemValidatorFields,
} from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

const folderTableFields = {
  ...commonSidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.boolean(),
}

export const foldersTables = {
  folders: defineTable(folderTableFields)
    .index('by_campaign_location_parent_name', ['campaignId', 'location', 'parentId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug'])
    .index('by_campaign_deletionTime', ['campaignId', 'deletionTime']),
}

const folderValidatorFields = {
  ...commonValidatorFields('folders'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.boolean(),
}

export const folderValidator = v.object(folderValidatorFields)

export { folderValidatorFields }
