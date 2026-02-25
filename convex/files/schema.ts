import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import {
  commonSidebarItemTableFields,
  commonSidebarItemValidatorFields,
} from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { folderValidator } from '../folders/baseSchema'

const fileTableFields = {
  ...commonSidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.union(v.id('_storage'), v.null()),
}

export const filesTables = {
  files: defineTable({
    ...fileTableFields,
  })
    .index('by_campaign_parent_name', ['campaignId', 'parentId', 'name'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const fileValidatorFields = {
  ...commonValidatorFields('files'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.union(v.id('_storage'), v.null()),
  downloadUrl: v.union(v.string(), v.null()),
  contentType: v.union(v.string(), v.null()),
} as const

export const fileValidator = v.object(fileValidatorFields)

export const fileWithContentValidator = v.object({
  ...fileValidatorFields,
  ancestors: v.array(folderValidator),
})
