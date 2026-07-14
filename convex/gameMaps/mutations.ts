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
import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { MapPinId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { resourceIdValidator } from '../resources/validators'
import {
  requireSidebarItemRow,
  requireSidebarItemRows,
} from '../sidebarItems/functions/sidebarItemIdentity'

const mapPinIdValidator = v.string()

function parseMapPinId(value: string): MapPinId {
  const mapPinId = parseDomainId(DOMAIN_ID_KIND.mapPin, value)
  if (!mapPinId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Map pin ID must be a lowercase UUIDv7')
  }
  return mapPinId
}

export const beginMapImageReplacement = campaignMutation({
  args: {
    mapId: resourceIdValidator,
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const map = await requireSidebarItemRow(ctx, args.mapId)
    return await beginMapImageReplacementFn(ctx, { mapId: map._id })
  },
})

export const updateMapImage = campaignMutation({
  args: {
    layerId: v.optional(v.nullable(v.string())),
    mapId: resourceIdValidator,
    replacementToken: v.nullable(v.string()),
    uploadSessionId: v.nullable(v.id('fileStorage')),
  },
  returns: v.object({
    mapId: resourceIdValidator,
  }),
  handler: async (ctx, args): Promise<{ mapId: ResourceId }> => {
    const map = await requireSidebarItemRow(ctx, args.mapId)
    await updateMapImageFn(ctx, {
      mapId: map._id,
      layerId: args.layerId ?? null,
      replacementToken: args.replacementToken,
      uploadSessionId: args.uploadSessionId,
    })
    return { mapId: args.mapId }
  },
})

export const createItemPins = campaignMutation({
  args: {
    mapId: resourceIdValidator,
    pins: v.array(
      v.object({
        itemId: resourceIdValidator,
        layerId: v.optional(v.nullable(v.string())),
        x: v.number(),
        y: v.number(),
      }),
    ),
  },
  returns: v.array(mapPinIdValidator),
  handler: async (ctx, args): Promise<Array<MapPinId>> => {
    const [map, items] = await Promise.all([
      requireSidebarItemRow(ctx, args.mapId),
      requireSidebarItemRows(
        ctx,
        args.pins.map((pin) => pin.itemId),
      ),
    ])
    return await createItemPinsFn(ctx, {
      mapId: map._id,
      pins: args.pins.map((pin, index) => {
        const item = items[index]
        if (!item) throw new Error('Resolved pin items do not match the request')
        return { ...pin, itemId: item._id }
      }),
    })
  },
})

export const updateItemPin = campaignMutation({
  args: {
    mapPinId: mapPinIdValidator,
    x: v.number(),
    y: v.number(),
  },
  returns: mapPinIdValidator,
  handler: async (ctx, args): Promise<MapPinId> => {
    return await updateItemPinFn(ctx, {
      mapPinId: parseMapPinId(args.mapPinId),
      x: args.x,
      y: args.y,
    })
  },
})

export const updatePinVisibility = campaignMutation({
  args: {
    mapPinId: mapPinIdValidator,
    visible: v.boolean(),
  },
  returns: mapPinIdValidator,
  handler: async (ctx, args): Promise<MapPinId> => {
    return await updatePinVisibilityFn(ctx, {
      mapPinId: parseMapPinId(args.mapPinId),
      visible: args.visible,
    })
  },
})

export const removeItemPin = campaignMutation({
  args: {
    mapPinId: mapPinIdValidator,
  },
  returns: mapPinIdValidator,
  handler: async (ctx, args): Promise<MapPinId> => {
    return await removeItemPinFn(ctx, {
      mapPinId: parseMapPinId(args.mapPinId),
    })
  },
})
