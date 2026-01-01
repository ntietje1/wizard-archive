import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { sidebarItemBaseFields } from '../sidebarItems/baseFields'

const noteTableFields = {
  ...sidebarItemBaseFields,
  type: v.literal('notes'),
}

export const notesTables = {
  notes: defineTable({
    ...noteTableFields,
  })
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_category', ['campaignId', 'categoryId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const noteValidatorFields = {
  _id: v.id('notes'),
  _creationTime: v.number(),
  ...noteTableFields,
  type: v.literal('notes'),
} as const

export const noteValidator = v.object(noteValidatorFields)

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(v.any()),
})
