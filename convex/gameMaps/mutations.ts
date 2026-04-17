import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/createParentTarget'
import { requireSidebarItemColor, requireOptionalSidebarItemColor } from '../sidebarItems/color'
import {
  requireOptionalSidebarItemIconName,
  requireSidebarItemIconName,
} from '../sidebarItems/icon'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
import { requireSidebarItemName } from '../sidebarItems/sharedValidation'
import { createMap as createMapFn } from './functions/createMap'
import { updateMap as updateMapFn } from './functions/updateMap'
import { createItemPin as createItemPinFn } from './functions/createItemPin'
import { updateItemPin as updateItemPinFn } from './functions/updateItemPin'
import { updatePinVisibility as updatePinVisibilityFn } from './functions/updatePinVisibility'
import { removeItemPin as removeItemPinFn } from './functions/removeItemPin'
import type { Id } from '../_generated/dataModel'

export const createMap = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    imageStorageId: v.optional(v.id('_storage')),
    iconName: v.optional(sidebarItemIconNameValidator),
    color: v.optional(sidebarItemColorValidator),
  },
  returns: v.object({
    mapId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ mapId: Id<'sidebarItems'>; slug: string }> => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    const iconName =
      args.iconName === undefined ? undefined : requireSidebarItemIconName(args.iconName)
    const color = args.color === undefined ? undefined : requireSidebarItemColor(args.color)
    return await createMapFn(ctx, {
      name,
      imageStorageId: args.imageStorageId,
      parentTarget,
      iconName,
      color,
    })
  },
})

export const updateMap = campaignMutation({
  args: {
    mapId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    imageStorageId: v.optional(v.nullable(v.id('_storage'))),
    iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
    color: v.optional(v.nullable(sidebarItemColorValidator)),
  },
  returns: v.object({
    mapId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ mapId: Id<'sidebarItems'>; slug: string }> => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    const iconName = requireOptionalSidebarItemIconName(args.iconName)
    const color = requireOptionalSidebarItemColor(args.color)
    return await updateMapFn(ctx, {
      mapId: args.mapId,
      name,
      imageStorageId: args.imageStorageId,
      iconName,
      color,
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
