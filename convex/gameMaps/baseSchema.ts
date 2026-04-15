import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { convexValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

const mapValidatorFields = {
  ...sidebarItemValidatorFields,
  imageStorageId: v.nullable(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
}

export const mapValidator = v.object(mapValidatorFields)

const mapPinTableFields = {
  mapId: v.id('sidebarItems'),
  itemId: v.id('sidebarItems'),
  x: v.number(),
  y: v.number(),
  visible: v.boolean(),
}

export const mapPinValidatorFields = {
  ...convexValidatorFields('mapPins'),
  ...mapPinTableFields,
}

export const mapPinValidator = v.object(mapPinValidatorFields)

export const mapPinsTables = {
  mapPins: defineTable({
    ...mapPinTableFields,
  }).index('by_map_item', ['mapId', 'itemId']),
}
