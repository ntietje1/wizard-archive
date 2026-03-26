import { v } from 'convex/values'
import { authMutation } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { createMap as createMapFn } from './functions/createMap'
import { updateMap as updateMapFn } from './functions/updateMap'
import { createItemPin as createItemPinFn } from './functions/createItemPin'
import { updateItemPin as updateItemPinFn } from './functions/updateItemPin'
import { updatePinVisibility as updatePinVisibilityFn } from './functions/updatePinVisibility'
import { removeItemPin as removeItemPinFn } from './functions/removeItemPin'
import type { Id } from '../_generated/dataModel'

export const createMap = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    parentId: v.union(v.id('folders'), v.null()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    mapId: v.id('gameMaps'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ mapId: Id<'gameMaps'>; slug: string }> => {
    return await createMapFn(ctx, {
      name: args.name,
      imageStorageId: args.imageStorageId,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      campaignId: args.campaignId,
    })
  },
})

export const updateMap = authMutation({
  args: {
    mapId: v.id('gameMaps'),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.union(v.id('_storage'), v.null())),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    mapId: v.id('gameMaps'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ mapId: Id<'gameMaps'>; slug: string }> => {
    return await updateMapFn(ctx, {
      mapId: args.mapId,
      name: args.name,
      imageStorageId: args.imageStorageId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createItemPin = authMutation({
  args: {
    mapId: v.id('gameMaps'),
    x: v.number(),
    y: v.number(),
    itemId: sidebarItemIdValidator,
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

export const updateItemPin = authMutation({
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

export const updatePinVisibility = authMutation({
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

export const removeItemPin = authMutation({
  args: {
    mapPinId: v.id('mapPins'),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    return await removeItemPinFn(ctx, { mapPinId: args.mapPinId })
  },
})
