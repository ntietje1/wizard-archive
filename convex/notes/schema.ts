import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemBaseFields,
  sidebarItemTableFields,
} from '../sidebarItems/schema/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { folderValidator } from '../folders/baseSchema'

const noteTableFields = {
  ...sidebarItemTableFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.notes),
}

export const notesTables = {
  notes: defineTable({
    ...noteTableFields,
  })
    .index('by_campaign_parent_name', ['campaignId', 'parentId', 'name'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const noteValidatorFields = {
  _id: v.id('notes'),
  _creationTime: v.number(),
  ...sidebarItemBaseFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.notes),
} as const

export const noteValidator = v.object(noteValidatorFields)

const blockMetaValidator = v.object({
  myPermissionLevel: v.union(
    v.literal('none'),
    v.literal('view'),
    v.literal('edit'),
    v.literal('full_access'),
  ),
  shareStatus: v.union(
    v.literal('all_shared'),
    v.literal('not_shared'),
    v.literal('individually_shared'),
  ),
  sharedWith: v.array(v.id('campaignMembers')),
})

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(v.any()),
  blockMeta: v.record(v.string(), blockMetaValidator),
  ancestors: v.array(folderValidator),
})
