import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { sidebarItemBaseFields } from '../sidebarItems/baseFields'

const folderTableFields = {
  ...sidebarItemBaseFields,
  type: v.literal('folders'),
}

export const foldersTables = {
  folders: defineTable({
    ...folderTableFields,
  })
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_category', ['campaignId', 'categoryId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const folderValidatorFields = {
  _id: v.id('folders'),
  _creationTime: v.number(),
  ...folderTableFields,
  type: v.literal('folders'),
} as const

export const folderValidator = v.object(folderValidatorFields)
