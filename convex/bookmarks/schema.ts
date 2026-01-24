import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'

const bookmarkTableFields = {
  campaignId: v.id('campaigns'),
  sidebarItemId: sidebarItemIdValidator,
  sidebarItemType: sidebarItemTypeValidator,
  campaignMemberId: v.id('campaignMembers'),
}

export const bookmarkTables = {
  bookmarks: defineTable({
    ...bookmarkTableFields,
  }).index('by_campaign_member_item', [
    'campaignId',
    'campaignMemberId',
    'sidebarItemId',
  ]),
}

const bookmarkValidatorFields = {
  _id: v.id('bookmarks'),
  _creationTime: v.number(),
  ...bookmarkTableFields,
} as const

export const bookmarkValidator = v.object(bookmarkValidatorFields)
