import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagCategoryValidator, tagValidatorFields } from '../tags/schema'
import { tagBackedEntityFields } from '../tags/schema'

const locationTableFields = {
  ...tagBackedEntityFields,
}

const mapTableFields = {
  userId: v.string(),
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  imageStorageId: v.optional(v.id('_storage')),
  categoryId: v.optional(v.id('tagCategories')),
  parentFolderId: v.optional(v.id('folders')),
  updatedAt: v.number(),
}

const mapValidatorFields = {
  _id: v.id('maps'),
  _creationTime: v.number(),
  ...mapTableFields,
  category: v.optional(tagCategoryValidator),
  type: v.literal('maps'),
} as const

export const locationTables = {
  locations: defineTable({
    ...locationTableFields,
  }).index('by_campaign_tag', ['campaignId', 'tagId']),

  maps: defineTable({
    ...mapTableFields,
  }).index('by_campaign_category_parent', [
    'campaignId',
    'categoryId',
    'parentFolderId',
  ]),

  mapPins: defineTable({
    mapId: v.id('maps'),
    locationId: v.id('locations'),
    x: v.number(),
    y: v.number(),
  })
    .index('by_map_location', ['mapId', 'locationId'])
    .index('by_map', ['mapId'])
    .index('by_location', ['locationId']),
}

const locationValidatorFields = {
  ...tagValidatorFields,
  ...locationTableFields,
} as const

export const locationValidator = v.object({
  ...locationValidatorFields,
  locationId: v.id('locations'), // additional field to be explicit about which field is the id
})

export const mapValidator = v.object(mapValidatorFields)
