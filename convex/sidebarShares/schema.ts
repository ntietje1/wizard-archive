import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'
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
  sessionId: v.nullable(v.id('sessions')),
  permissionLevel: v.nullable(permissionLevelValidator),
  ...commonTableFields,
}

export const sidebarShareTables = {
  sidebarItemShares: defineTable({
    ...sidebarItemShareTableFields,
  })
    .index('by_campaign_session', ['campaignId', 'sessionId'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_item_member', ['campaignId', 'sidebarItemId', 'campaignMemberId']),
}

const sidebarItemShareValidatorFields = {
  ...commonValidatorFields('sidebarItemShares'),
  ...sidebarItemShareTableFields,
}

export const sidebarItemShareValidator = v.object(sidebarItemShareValidatorFields)
