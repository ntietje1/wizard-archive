import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const blockShareTableFields = {
  campaignId: v.id('campaigns'),
  noteId: v.id('sidebarItems'),
  blockId: v.id('blocks'),
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.nullable(v.id('sessions')),
}

export const blockShareTables = {
  blockShares: defineTable({
    ...blockShareTableFields,
  })
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_block_member', ['campaignId', 'blockId', 'campaignMemberId']),
}

const blockShareValidatorFields = {
  ...convexValidatorFields('blockShares'),
  ...blockShareTableFields,
}

export const blockShareValidator = v.object(blockShareValidatorFields)
