import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { CATEGORY_KIND } from './types'
import { commonMetaFields } from '../common/schema'

export const categoryKindValidator = v.union(
  v.literal(CATEGORY_KIND.SystemCore),
  v.literal(CATEGORY_KIND.SystemManaged),
  v.literal(CATEGORY_KIND.User),
)

export const tagCategoryTableFields = {
  pluralDisplayName: v.string(),
  displayName: v.string(),
  name: v.string(),
  kind: categoryKindValidator,
  campaignId: v.id('campaigns'),
  iconName: v.string(),
  defaultColor: v.optional(v.string()),
}

export const tagTableFields = {
  displayName: v.string(),
  name: v.string(),
  color: v.string(),
  description: v.optional(v.string()),
  campaignId: v.id('campaigns'),
  categoryId: v.id('tagCategories'),
}

export const createTagAndNoteArgs = {
  ...tagTableFields,
  parentFolderId: v.optional(v.id('folders')),
}

export const tagTables = {
  tagCategories: defineTable({
    ...commonMetaFields('tagCategories'),
    ...tagCategoryTableFields,
  }).index('by_campaign_name', ['campaignId', 'name']),

  tags: defineTable({
    ...commonMetaFields('tags'),
    ...tagTableFields,
  })
    .index('by_campaign_categoryId', ['campaignId', 'categoryId'])
    .index('by_campaign_name', ['campaignId', 'name']),
}

const tagCategoryValidatorFields = {
  ...commonMetaFields('tagCategories'),
  ...tagCategoryTableFields,
} as const

export const tagValidatorFields = {
  ...commonMetaFields('tags'),
  ...tagTableFields,
  category: v.optional(v.object(tagCategoryValidatorFields)),
} as const

export const tagCategoryValidator = v.object(tagCategoryValidatorFields)

export const tagValidator = v.object(tagValidatorFields)

export const tagBackedEntityFields = {
  campaignId: v.id('campaigns'),
  tagId: v.id('tags'),
} as const
