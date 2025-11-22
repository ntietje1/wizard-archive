import { v } from "convex/values";
import { tagCategoryValidator } from "../tags/schema";
import { noteValidator } from "../notes/schema";
import { defineTable } from "convex/server";
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";


export const mapTableFields = {
  userId: v.id('userProfiles'),
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

export const mapValidator = v.object(mapValidatorFields)
export const mapPinTableFields = {
  mapId: v.id('maps'),
  itemType: v.union(v.literal(SIDEBAR_ITEM_TYPES.notes), v.literal(SIDEBAR_ITEM_TYPES.maps)),
  noteId: v.optional(v.id('notes')),
  pinnedMapId: v.optional(v.id('maps')),
  iconName: v.string(),
  color: v.optional(v.string()),
  x: v.number(),
  y: v.number(),
}

const mapPinValidatorFields = {
  _id: v.id('mapPins'),
  _creationTime: v.number(),
  mapId: v.id('maps'),
  x: v.number(),
  y: v.number(),
  iconName: v.string(),
  color: v.optional(v.string()),
} as const

// Discriminated union validator - ensures either noteId or pinnedMapId is set based on itemType
export const mapPinValidator = v.union(
  v.object({
    ...mapPinValidatorFields,
    itemType: v.literal(SIDEBAR_ITEM_TYPES.notes),
    noteId: v.id('notes'),
    pinnedMapId: v.optional(v.id('maps'))
  }),
  v.object({
    ...mapPinValidatorFields,
    itemType: v.literal(SIDEBAR_ITEM_TYPES.maps),
    noteId: v.optional(v.id('notes')),
    pinnedMapId: v.id('maps')
  })
)

export const mapPinWithItemValidator = v.union(
  v.object({
    ...mapPinValidatorFields,
    itemType: v.literal(SIDEBAR_ITEM_TYPES.notes),
    noteId: v.id('notes'),
    pinnedMapId: v.optional(v.id('maps')),
    item: noteValidator,
  }),
  v.object({
    ...mapPinValidatorFields,
    itemType: v.literal(SIDEBAR_ITEM_TYPES.maps),
    noteId: v.optional(v.id('notes')),
    pinnedMapId: v.id('maps'),
    item: mapValidator,
  })
)

export const mapTables = {  
    maps: defineTable({
      ...mapTableFields,
    }).index('by_campaign_category_parent', [
      'campaignId',
      'categoryId',
      'parentFolderId',
    ]),
  
    mapPins: defineTable({
      ...mapPinTableFields,
    })
      .index('by_map_itemType', ['mapId', 'itemType']),
}
  
