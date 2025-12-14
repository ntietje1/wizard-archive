import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'

export const mapTableFields = {
  name: v.optional(v.string()),
  iconName: v.optional(v.string()),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  categoryId: v.optional(v.id('tagCategories')),
  parentId: v.optional(sidebarItemIdValidator),
  imageStorageId: v.optional(v.id('_storage')),
  updatedAt: v.number(),
  type: v.literal('gameMaps'),
}
const mapValidatorFields = {
  _id: v.id('gameMaps'),
  _creationTime: v.number(),
  ...mapTableFields,
  type: v.literal('gameMaps'),
} as const

export const mapValidator = v.object(mapValidatorFields)
export const mapPinTableFields = {
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  iconName: v.string(),
  color: v.optional(v.string()),
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
