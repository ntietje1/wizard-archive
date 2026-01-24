import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import {
  sidebarItemBaseFields,
  sidebarItemTableFields,
} from '../sidebarItems/schema/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'

export const mapTableFields = {
  ...sidebarItemTableFields,
  imageStorageId: v.optional(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
}

const mapValidatorFields = {
  _id: v.id('gameMaps'),
  _creationTime: v.number(),
  ...sidebarItemBaseFields,
  imageStorageId: v.optional(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.union(v.string(), v.null()),
} as const

export const mapValidator = v.object(mapValidatorFields)

export const mapPinTableFields = {
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  x: v.number(),
  y: v.number(),
  updatedAt: v.number(),
}

const mapPinValidatorFields = {
  _id: v.id('mapPins'),
  _creationTime: v.number(),
  ...mapPinTableFields,
} as const

export const mapPinValidator = v.object(mapPinValidatorFields)

export const mapTables = {
  gameMaps: defineTable({
    ...mapTableFields,
  })
    .index('by_campaign_parent_name', ['campaignId', 'parentId', 'name'])
    .index('by_campaign_name', ['campaignId', 'name'])
    .index('by_campaign_slug', ['campaignId', 'slug']),

  mapPins: defineTable({
    ...mapPinTableFields,
  }).index('by_map_item', ['mapId', 'itemId']),
}
