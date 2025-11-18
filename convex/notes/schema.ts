import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagCategoryValidator, tagValidator } from '../tags/schema'
import { mapValidator } from '../locations/schema'

export const blockNoteIdValidator = v.string()

export const customBlockValidator = v.any() // BlockNote block content

const blockTableFields = {
  noteId: v.id('notes'),
  blockId: v.string(),
  position: v.optional(v.number()),
  content: customBlockValidator,
  isTopLevel: v.boolean(),
  campaignId: v.id('campaigns'),
  updatedAt: v.number(),
}

const blockTagTableFields = {
  campaignId: v.id('campaigns'),
  blockId: v.id('blocks'),
  tagId: v.id('tags'),
}

const noteTableFields = {
  userId: v.string(),
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  slug: v.string(),
  updatedAt: v.number(),
  categoryId: v.optional(v.id('tagCategories')),
  tagId: v.optional(v.id('tags')),
  parentFolderId: v.optional(v.id('folders')),
}

const folderTableFields = {
  userId: v.string(),
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  updatedAt: v.number(),
  categoryId: v.optional(v.id('tagCategories')),
  parentFolderId: v.optional(v.id('folders')),
}

export const notesTables = {
  notes: defineTable({
    ...noteTableFields,
  })
    .index('by_campaign_category_parent', [
      'campaignId',
      'categoryId',
      'parentFolderId',
    ])
    .index('by_campaign_category_tag', ['campaignId', 'categoryId', 'tagId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),

  folders: defineTable({
    ...folderTableFields,
  }).index('by_campaign_category_parent', [
    'campaignId',
    'categoryId',
    'parentFolderId',
  ]),

  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note_toplevel_pos', [
      'campaignId',
      'noteId',
      'isTopLevel',
      'position',
    ])
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockId']),

  blockTags: defineTable({
    ...blockTagTableFields,
  }).index('by_campaign_block_tag', ['campaignId', 'blockId', 'tagId']),
}

const blockValidatorFields = {
  _id: v.id('blocks'),
  _creationTime: v.number(),
  ...blockTableFields,
} as const

const blockTagValidatorFields = {
  _id: v.id('blockTags'),
  _creationTime: v.number(),
  ...blockTagTableFields,
} as const

const noteValidatorFields = {
  _id: v.id('notes'),
  _creationTime: v.number(),
  ...noteTableFields,
  category: v.optional(tagCategoryValidator),
  type: v.literal('notes'),
  tag: v.optional(tagValidator),
} as const

const folderValidatorFields = {
  _id: v.id('folders'),
  _creationTime: v.number(),
  ...folderTableFields,
  category: v.optional(tagCategoryValidator),
  type: v.literal('folders'),
} as const

export const blockValidator = v.object(blockValidatorFields)

export const blockTagValidator = v.object(blockTagValidatorFields)

export const noteValidator = v.object(noteValidatorFields)

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(customBlockValidator),
})

export const folderValidator = v.object(folderValidatorFields)

export const sidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
)

export const folderWithChildrenValidator = v.object({
  ...folderValidatorFields,
  children: v.optional(v.array(sidebarItemValidator)),
})
