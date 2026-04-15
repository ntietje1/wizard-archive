import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const bookmarkTableFields = {
  campaignId: v.id('campaigns'),
  sidebarItemId: v.id('sidebarItems'),
  campaignMemberId: v.id('campaignMembers'),
}

export const bookmarkTables = {
  bookmarks: defineTable({
    ...bookmarkTableFields,
  })
    .index('by_campaign_member_item', ['campaignId', 'campaignMemberId', 'sidebarItemId'])
    .index('by_campaign_item', ['campaignId', 'sidebarItemId']),
}

const bookmarkValidatorFields = {
  ...convexValidatorFields('bookmarks'),
  ...bookmarkTableFields,
}

export const bookmarkValidator = v.object(bookmarkValidatorFields)
