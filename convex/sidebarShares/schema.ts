import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  permissionLevelValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/validators'
import { resourceShareIdValidator } from './validators'

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
    resourceShareUuid: resourceShareIdValidator,
    ...sidebarItemShareTableFields,
  })
    .index('by_resourceShareUuid', ['resourceShareUuid'])
    .index('by_campaign_member', ['campaignId', 'campaignMemberId'])
    .index('by_campaign_item_member', ['campaignId', 'sidebarItemId', 'campaignMemberId']),
}

export const sidebarItemShareValidator = v.object({
  id: resourceShareIdValidator,
  createdAt: v.number(),
  ...sidebarItemShareTableFields,
})
