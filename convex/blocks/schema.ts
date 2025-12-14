import { defineTable } from 'convex/server'
import { v } from 'convex/values'

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

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  }).index('by_campaign_note_block', ['campaignId', 'noteId', 'blockId']),

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

export const blockValidator = v.object(blockValidatorFields)

export const blockTagValidator = v.object(blockTagValidatorFields)
