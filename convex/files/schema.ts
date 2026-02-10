import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import {
  sidebarItemBaseFields,
  sidebarItemTableFields,
} from '../sidebarItems/schema/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { folderValidator } from '../folders/baseSchema'

const fileTableFields = {
  ...sidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.optional(v.id('_storage')),
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
  _id: v.id('files'),
  _creationTime: v.number(),
  ...sidebarItemBaseFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.optional(v.id('_storage')),
  downloadUrl: v.union(v.string(), v.null()),
  contentType: v.union(v.string(), v.null()),
} as const

export const fileValidator = v.object(fileValidatorFields)

export const fileWithContentValidator = v.object({
  ...fileValidatorFields,
  ancestors: v.array(folderValidator),
})
