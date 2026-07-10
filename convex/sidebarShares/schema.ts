import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { domainValidatorFields } from '../common/schema'
import {
  permissionLevelValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/validators'

const sidebarItemShareTableFields = {
  campaignId: v.id('campaigns'),
  sidebarItemId: v.id('sidebarItems'),
  sidebarItemType: sidebarItemTypeValidator,
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.nullable(v.id('sessions')),
  permissionLevel: v.nullable(permissionLevelValidator),
}

export const sidebarShareTables = {
  sidebarItemShares: defineTable({
    ...sidebarItemShareTableFields,
  })
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_item_member', ['campaignId', 'sidebarItemId', 'campaignMemberId']),
}

const sidebarItemShareValidatorFields = {
  ...domainValidatorFields('sidebarItemShares'),
  ...sidebarItemShareTableFields,
}

export const sidebarItemShareValidator = v.object(sidebarItemShareValidatorFields)
