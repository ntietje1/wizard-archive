import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemBaseFields, sidebarItemIdValidator } from '../sidebarItems/baseFields'

export const mapTableFields = {
  ...sidebarItemBaseFields,
  imageStorageId: v.optional(v.id('_storage')),
  type: v.literal('gameMaps'),
}
const mapValidatorFields = {
  _id: v.id('gameMaps'),
  _creationTime: v.number(),
  ...mapTableFields,
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
    .index('by_campaign_parent', ['campaignId', 'parentId'])
    .index('by_campaign_category', ['campaignId', 'categoryId'])
    .index('by_campaign_slug', ['campaignId', 'slug']),

  mapPins: defineTable({
    ...mapPinTableFields,
  }).index('by_map_item', ['mapId', 'itemId']),
}
