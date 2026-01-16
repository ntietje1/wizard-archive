import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { sidebarItemBaseFields } from '../sidebarItems/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { customBlockValidator } from '../blocks/schema'

const folderTableFields = {
  ...sidebarItemBaseFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
}

export const foldersTables = {
  folders: defineTable({
    ...folderTableFields,
  })
    .index('by_campaign_parent_name', ['campaignId', 'parentId', 'name'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),
}

const folderValidatorFields = {
  _id: v.id('folders'),
  _creationTime: v.number(),
  ...folderTableFields,
} as const

export const folderValidator = v.object(folderValidatorFields)

export const downloadableItemValidator = v.union(
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.files),
    id: v.id('files'),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.notes),
    id: v.id('notes'),
    name: v.string(),
    path: v.string(),
    content: v.array(customBlockValidator),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
    id: v.id('gameMaps'),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
)
