import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemBaseFields } from '../sidebarItems/baseFields'

const fileTableFields = {
  ...sidebarItemBaseFields,
  type: v.literal('files'),
  storageId: v.id('_storage'),
}

export const filesTables = {
  files: defineTable({
    ...fileTableFields,
  })
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_category', ['campaignId', 'categoryId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const fileValidatorFields = {
  _id: v.id('files'),
  _creationTime: v.number(),
  ...fileTableFields,
} as const

export const fileValidator = v.object(fileValidatorFields)
