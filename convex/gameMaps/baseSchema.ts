import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { domainValidatorFields } from '../common/schema'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'

export const mapLayerValidator = v.object({
  id: v.string(),
  imageAssetId: v.nullable(v.id('_storage')),
  imageUrl: v.nullable(v.string()),
  name: v.string(),
})

export const mapValidatorFields = {
  ...sidebarItemValidatorFields,
  imageAssetId: v.nullable(v.id('_storage')),
  type: v.literal(RESOURCE_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
  layers: v.optional(v.array(mapLayerValidator)),
}

export const mapValidator = v.object(mapValidatorFields)

const mapPinTableFields = {
  layerId: v.optional(v.nullable(v.string())),
  mapId: v.id('sidebarItems'),
  itemId: v.id('sidebarItems'),
  x: v.number(),
  y: v.number(),
  visible: v.boolean(),
}

export const mapPinValidatorFields = {
  ...domainValidatorFields('mapPins'),
  ...mapPinTableFields,
}

export const mapPinValidator = v.object(mapPinValidatorFields)

export const mapPinsTables = {
  mapPins: defineTable({
    ...mapPinTableFields,
  }).index('by_map_item', ['mapId', 'itemId']),
}
