import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createMap as createMapFn } from './functions/createMap'
import { updateMap as updateMapFn } from './functions/updateMap'
import { createItemPin as createItemPinFn } from './functions/createItemPin'
import { updateItemPin as updateItemPinFn } from './functions/updateItemPin'
import { updatePinVisibility as updatePinVisibilityFn } from './functions/updatePinVisibility'
import { removeItemPin as removeItemPinFn } from './functions/removeItemPin'
import type { Id } from '../_generated/dataModel'

export const createMap = campaignMutation({
  args: {
    name: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    parentId: v.nullable(v.id('sidebarItems')),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    mapId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ mapId: Id<'sidebarItems'>; slug: string }> => {
    return await createMapFn(ctx, {
      name: args.name,
      imageStorageId: args.imageStorageId,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const updateMap = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.nullable(v.id('_storage'))),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    mapId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ mapId: Id<'sidebarItems'>; slug: string }> => {
    return await updateMapFn(ctx, {
      mapId: args.mapId,
      name: args.name,
      imageStorageId: args.imageStorageId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createItemPin = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
    x: v.number(),
    y: v.number(),
    itemId: v.id('sidebarItems'),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    return await createItemPinFn(ctx, {
      mapId: args.mapId,
      x: args.x,
      y: args.y,
      itemId: args.itemId,
    })
  },
})

export const updateItemPin = campaignMutation({
  args: {
    mapPinId: v.id('mapPins'),
    x: v.number(),
    y: v.number(),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    return await updateItemPinFn(ctx, {
      mapPinId: args.mapPinId,
      x: args.x,
      y: args.y,
    })
  },
})

export const updatePinVisibility = campaignMutation({
  args: {
    mapPinId: v.id('mapPins'),
    visible: v.boolean(),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    return await updatePinVisibilityFn(ctx, {
      mapPinId: args.mapPinId,
      visible: args.visible,
    })
  },
})

export const removeItemPin = campaignMutation({
  args: {
    mapPinId: v.id('mapPins'),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    return await removeItemPinFn(ctx, { mapPinId: args.mapPinId })
  },
})
