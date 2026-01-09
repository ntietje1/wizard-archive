import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemBaseFields } from '../sidebarItems/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

const fileTableFields = {
  ...sidebarItemBaseFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.id('_storage'),
}

export const filesTables = {
  files: defineTable({
    ...fileTableFields,
  })
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const fileValidatorFields = {
  _id: v.id('files'),
  _creationTime: v.number(),
  ...fileTableFields,
} as const

export const fileValidator = v.object(fileValidatorFields)
