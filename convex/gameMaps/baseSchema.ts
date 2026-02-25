import { v } from 'convex/values'
import { defineTable } from 'convex/server'
import {
  commonSidebarItemTableFields,
  commonSidebarItemValidatorFields,
} from '../sidebarItems/schema/baseFields'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

export const mapTableFields = {
  ...commonSidebarItemTableFields,
  imageStorageId: v.union(v.id('_storage'), v.null()),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
}

const mapValidatorFields = {
  ...commonValidatorFields('gameMaps'),
  ...commonSidebarItemValidatorFields,
  imageStorageId: v.union(v.id('_storage'), v.null()),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.union(v.string(), v.null()),
}

export const mapValidator = v.object(mapValidatorFields)

export const mapPinTableFields = {
  mapId: v.id('gameMaps'),
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

export const gameMapsTables = {
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
