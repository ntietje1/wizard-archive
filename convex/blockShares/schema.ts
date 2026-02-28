import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

const blockShareTableFields = {
  campaignId: v.id('campaigns'),
  noteId: v.id('notes'),
  blockId: v.id('blocks'),
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.optional(v.id('sessions')),
  ...commonTableFields,
}

export const blockShareTables = {
  blockShares: defineTable({
    ...blockShareTableFields,
  })
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_session', ['campaignId', 'sessionId'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_block_member', [
      'campaignId',
      'blockId',
      'campaignMemberId',
    ]),
}

const blockShareValidatorFields = {
  ...commonValidatorFields('blockShares'),
  ...blockShareTableFields,
}

export const blockShareValidator = v.object(blockShareValidatorFields)
