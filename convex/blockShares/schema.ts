import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'

export const blockVisibilityPermissionLevelValidator = v.union(
  v.literal(PERMISSION_LEVEL.NONE),
  v.literal(PERMISSION_LEVEL.VIEW),
)

const blockShareTableFields = {
  campaignId: v.id('campaigns'),
  noteId: v.id('sidebarItems'),
  blockId: v.id('blocks'),
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.nullable(v.id('sessions')),
  permissionLevel: v.optional(v.nullable(blockVisibilityPermissionLevelValidator)),
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
