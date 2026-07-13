import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  beginMapImageReplacement as beginMapImageReplacementFn,
  updateMapImage as updateMapImageFn,
} from './functions/updateMap'
import { createItemPins as createItemPinsFn } from './functions/createItemPins'
import { updateItemPin as updateItemPinFn } from './functions/updateItemPin'
import { updatePinVisibility as updatePinVisibilityFn } from './functions/updatePinVisibility'
import { removeItemPin as removeItemPinFn } from './functions/removeItemPin'
import type { Id } from '../_generated/dataModel'

export const beginMapImageReplacement = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    return await beginMapImageReplacementFn(ctx, { mapId: args.mapId })
  },
})

export const updateMapImage = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
    replacementToken: v.nullable(v.string()),
    uploadSessionId: v.nullable(v.id('fileStorage')),
  },
  returns: v.object({
    mapId: v.id('sidebarItems'),
  }),
  handler: async (ctx, args): Promise<{ mapId: Id<'sidebarItems'> }> => {
    return await updateMapImageFn(ctx, {
      mapId: args.mapId,
      replacementToken: args.replacementToken,
      uploadSessionId: args.uploadSessionId,
    })
  },
})

export const createItemPins = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
    pins: v.array(
      v.object({
        itemId: v.id('sidebarItems'),
        layerId: v.optional(v.nullable(v.string())),
        x: v.number(),
        y: v.number(),
      }),
    ),
  },
  returns: v.array(v.id('mapPins')),
  handler: async (ctx, args): Promise<Array<Id<'mapPins'>>> => {
    return await createItemPinsFn(ctx, {
      mapId: args.mapId,
      pins: args.pins,
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
