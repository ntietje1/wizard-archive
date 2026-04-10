import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

const mapValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  imageStorageId: v.nullable(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
}

export const mapValidator = v.object(mapValidatorFields)

export const mapPinTableFields = {
  mapId: v.id('sidebarItems'),
  itemId: sidebarItemIdValidator,
  x: v.number(),
  y: v.number(),
  visible: v.boolean(),
  ...commonTableFields,
}

const mapPinValidatorFields = {
  ...commonValidatorFields('mapPins'),
  ...mapPinTableFields,
}

export const mapPinValidator = v.object(mapPinValidatorFields)

export const mapPinsTables = {
  mapPins: defineTable({
    ...mapPinTableFields,
  })
    .index('by_map_item', ['mapId', 'itemId'])
    .index('by_map_deletionTime', ['mapId', 'deletionTime']),
}
