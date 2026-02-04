import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'

const sidebarItemShareTableFields = {
  campaignId: v.id('campaigns'),
  sidebarItemId: sidebarItemIdValidator,
  sidebarItemType: sidebarItemTypeValidator,
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.optional(v.id('sessions')),
  permissionLevel: v.optional(permissionLevelValidator),
}

const blockShareTableFields = {
  campaignId: v.id('campaigns'),
  blockId: v.id('blocks'),
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.optional(v.id('sessions')),
}

export const shareTables = {
  sidebarItemShares: defineTable({
    ...sidebarItemShareTableFields,
  })
    .index('by_campaign_session', ['campaignId', 'sessionId'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_item_member', [
      'campaignId',
      'sidebarItemId',
      'campaignMemberId',
    ]),

  blockShares: defineTable({
    ...blockShareTableFields,
  })
    .index('by_campaign_session', ['campaignId', 'sessionId'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_block_member', [
      'campaignId',
      'blockId',
      'campaignMemberId',
    ]),
}

const sidebarItemShareValidatorFields = {
  _id: v.id('sidebarItemShares'),
  _creationTime: v.number(),
  ...sidebarItemShareTableFields,
} as const

const blockShareValidatorFields = {
  _id: v.id('blockShares'),
  _creationTime: v.number(),
  ...blockShareTableFields,
} as const

export const sidebarItemShareValidator = v.object(
  sidebarItemShareValidatorFields,
)
export const blockShareValidator = v.object(blockShareValidatorFields)
