import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'

export const editHistoryTables = {
  editHistory: defineTable({
    itemId: sidebarItemIdValidator,
    itemType: sidebarItemTypeValidator,
    campaignId: v.id('campaigns'),
    campaignMemberId: v.id('campaignMembers'),
    action: v.string(),
    metadata: v.union(v.record(v.string(), v.any()), v.null()),
  })
    .index('by_item', ['itemId'])
    .index('by_campaign', ['campaignId']),
}
