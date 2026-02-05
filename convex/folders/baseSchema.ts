import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemBaseFields,
  sidebarItemTableFields,
} from '../sidebarItems/schema/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'

const folderTableFields = {
  ...sidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.optional(v.boolean()),
}

export const foldersTables = {
  folders: defineTable({
    ...folderTableFields,
  })
    .index('by_campaign_parent_name', ['campaignId', 'parentId', 'name'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const folderValidatorFields = {
  _id: v.id('folders'),
  _creationTime: v.number(),
  ...sidebarItemBaseFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.optional(v.boolean()),
} as const

export const folderValidator = v.object(folderValidatorFields)

export { folderValidatorFields }
