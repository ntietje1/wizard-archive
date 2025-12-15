import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { CATEGORY_KIND } from './types'
import { commonMetaFields } from '../common/schema'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'

export const categoryKindValidator = v.union(
  v.literal(CATEGORY_KIND.SystemCore),
  v.literal(CATEGORY_KIND.SystemManaged),
  v.literal(CATEGORY_KIND.User),
)

export const tagCategoryTableFields = {
  name: v.optional(v.string()),
  slug: v.string(),
  kind: categoryKindValidator,
  campaignId: v.id('campaigns'),
  iconName: v.optional(v.string()),
  defaultColor: v.optional(v.string()),
  type: v.literal('tagCategories'),
  parentId: v.optional(sidebarItemIdValidator),
  categoryId: v.optional(v.id('tagCategories')),
}

export const tagTableFields = {
  name: v.optional(v.string()),
  iconName: v.optional(v.string()),
  slug: v.string(),
  color: v.optional(v.string()),
  description: v.optional(v.string()),
  imageStorageId: v.optional(v.id('_storage')),
  campaignId: v.id('campaigns'),
  categoryId: v.id('tagCategories'),
  parentId: v.optional(sidebarItemIdValidator),
  type: v.literal('tags'),
}

export const createTagAndNoteArgs = {
  name: v.optional(v.string()),
  iconName: v.optional(v.string()),
  color: v.optional(v.string()),
  description: v.optional(v.string()),
  imageStorageId: v.optional(v.id('_storage')),
  campaignId: v.id('campaigns'),
  categoryId: v.id('tagCategories'),
  parentId: v.optional(sidebarItemIdValidator),
}

export const tagTables = {
  tagCategories: defineTable({
    ...commonMetaFields('tagCategories'),
    ...tagCategoryTableFields,
  }).index('by_campaign_slug', ['campaignId', 'slug']),

  tags: defineTable({
    ...commonMetaFields('tags'),
    ...tagTableFields,
  })
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_category', ['campaignId', 'categoryId'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
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
