import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'

const bookmarkTableFields = {
  campaignId: v.id('campaigns'),
  sidebarItemId: sidebarItemIdValidator,
  campaignMemberId: v.id('campaignMembers'),
}

export const bookmarkTables = {
  bookmarks: defineTable({
    ...commonTableFields,
    ...bookmarkTableFields,
  })
    .index('by_campaign_member_item', [
      'campaignId',
      'campaignMemberId',
      'sidebarItemId',
    ])
    .index('by_campaign_item', ['campaignId', 'sidebarItemId']),
}

const bookmarkValidatorFields = {
  ...commonValidatorFields('bookmarks'),
  ...bookmarkTableFields,
}

export const bookmarkValidator = v.object(bookmarkValidatorFields)
