import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'
import { assetIdValidator } from '../resources/validators'

export const mapLayerValidator = v.object({
  id: v.string(),
  imageAssetId: v.nullable(assetIdValidator),
  imageUrl: v.nullable(v.string()),
  name: v.string(),
})

export const mapValidatorFields = {
  ...sidebarItemValidatorFields,
  imageAssetId: v.nullable(assetIdValidator),
  type: v.literal(RESOURCE_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
  layers: v.optional(v.array(mapLayerValidator)),
}

export const mapValidator = v.object(mapValidatorFields)

const mapPinIdValidator = v.string() as Validator<MapPinId>
const mapPinFields = {
  layerId: v.optional(v.nullable(v.string())),
  mapId: v.id('sidebarItems'),
  itemId: v.id('sidebarItems'),
  x: v.number(),
  y: v.number(),
  visible: v.boolean(),
}

export const mapPinValidatorFields = {
  id: mapPinIdValidator,
  createdAt: v.number(),
  ...mapPinFields,
}

export const mapPinValidator = v.object(mapPinValidatorFields)

export const mapPinsTables = {
  mapPins: defineTable({
    mapPinUuid: mapPinIdValidator,
    ...mapPinFields,
  })
    .index('by_mapPinUuid', ['mapPinUuid'])
    .index('by_map_item', ['mapId', 'itemId']),
}
