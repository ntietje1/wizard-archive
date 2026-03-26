import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

export const blockNoteIdValidator = v.string()

export const customBlockValidator = v.any() // BlockNote block content

export const blockShareStatusValidator = v.union(
  v.literal('all_shared'),
  v.literal('not_shared'),
  v.literal('individually_shared'),
)

const blockTableFields = {
  noteId: v.id('notes'),
  blockId: v.string(),
  position: v.union(v.number(), v.null()),
  content: customBlockValidator,
  isTopLevel: v.boolean(),
  campaignId: v.id('campaigns'),
  shareStatus: v.union(blockShareStatusValidator, v.null()),
  ...commonTableFields,
}

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockId'])
    .index('by_campaign_note_topLevel', ['campaignId', 'noteId', 'isTopLevel'])
    .index('by_campaign_note_shareStatus', [
      'campaignId',
      'noteId',
      'shareStatus',
    ]),
}

const blockValidatorFields = {
  ...commonValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)
