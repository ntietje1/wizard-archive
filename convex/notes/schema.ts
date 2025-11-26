import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagCategoryValidator, tagValidator } from '../tags/schema'

const noteTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  slug: v.string(),
  updatedAt: v.number(),
  categoryId: v.optional(v.id('tagCategories')),
  tagId: v.optional(v.id('tags')),
  parentId: v.optional(v.id('notes')),
}

export const notesTables = {
  notes: defineTable({
    ...noteTableFields,
  })
    .index('by_campaign_category_parent', [
      'campaignId',
      'categoryId',
      'parentId',
    ])
    .index('by_campaign_category_tag', ['campaignId', 'categoryId', 'tagId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const noteValidatorFields = {
  _id: v.id('notes'),
  _creationTime: v.number(),
  ...noteTableFields,
  category: v.optional(tagCategoryValidator),
  type: v.literal('notes'),
  tag: v.optional(tagValidator),
} as const

export const noteValidator = v.object(noteValidatorFields)
