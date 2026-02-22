import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  findNewSidebarItemSlug,
  requireItemAccess,
  validateCreateParent,
  validateMove,
  validateRename,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteMap as deleteMapHelper } from './gameMaps'
import type { Doc, Id } from '../_generated/dataModel'

export const createMap = campaignMutation({
  args: {
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    parentId: v.optional(v.id('folders')),
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
    await validateCreateParent(ctx, args.campaignId, args.parentId)

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

    const uniqueSlug = await findNewSidebarItemSlug(
      ctx,
      args.campaignId,
      SIDEBAR_ITEM_TYPES.gameMaps,
      args.name,
    )

    const mapId = await ctx.db.insert('gameMaps', {
      campaignId: args.campaignId,
      name: args.name,
      slug: uniqueSlug,
      iconName: args.iconName,
      color: args.color,
      imageStorageId: args.imageStorageId,
      parentId: args.parentId,
      updatedAt: Date.now(),
      type: SIDEBAR_ITEM_TYPES.gameMaps,
    })

    return { mapId, slug: uniqueSlug }
  },
})

export const updateMap = campaignMutation({
  args: {
    mapId: v.id('gameMaps'),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
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
    const rawMap = await ctx.db.get(args.mapId)
    const map = await requireItemAccess(
      ctx,
      args.campaignId,
      rawMap,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    const updates: Partial<Doc<'gameMaps'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      updates.slug = await validateRename(ctx, args.campaignId, map, args.name)
    }
    if (args.imageStorageId !== undefined) {
      updates.imageStorageId = args.imageStorageId
    }
    if (args.iconName !== undefined) {
      updates.iconName = args.iconName
    }
    if (args.color !== undefined) {
      updates.color = args.color
    }
    await ctx.db.patch(args.mapId, updates)
    return { mapId: args.mapId, slug: updates.slug || map.slug }
  },
})

export const moveMap = campaignMutation({
  args: {
    mapId: v.id('gameMaps'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    const rawMap = await ctx.db.get(args.mapId)
    const map = await requireItemAccess(
      ctx,
      args.campaignId,
      rawMap,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    await validateMove(ctx, map, args.parentId)

    await ctx.db.patch(args.mapId, {
      parentId: args.parentId,
      updatedAt: Date.now(),
    })
    return args.mapId
  },
})

export const deleteMap = campaignMutation({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    const rawMap = await ctx.db.get(args.mapId)
    await requireItemAccess(
      ctx,
      args.campaignId,
      rawMap,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    await deleteMapHelper(ctx, args.mapId, args.campaignId)
    return args.mapId
  },
})

export const createItemPin = campaignMutation({
  args: {
    mapId: v.id('gameMaps'),
    x: v.number(),
    y: v.number(),
    itemId: sidebarItemIdValidator,
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const rawMap = await ctx.db.get(args.mapId)
    await requireItemAccess(ctx, args.campaignId, rawMap, PERMISSION_LEVEL.EDIT)

    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new Error('Item not found')
    }
    return await ctx.db.insert('mapPins', {
      mapId: args.mapId,
      itemId: args.itemId,
      x: args.x,
      y: args.y,
      visible: false,
      updatedAt: Date.now(),
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
    const pin = await ctx.db.get(args.mapPinId)
    if (!pin) {
      throw new Error('Pin not found')
    }

    const rawMap = await ctx.db.get(pin.mapId)
    await requireItemAccess(ctx, args.campaignId, rawMap, PERMISSION_LEVEL.EDIT)

    await ctx.db.patch(args.mapPinId, {
      x: args.x,
      y: args.y,
      updatedAt: Date.now(),
    })

    return args.mapPinId
  },
})

export const updatePinVisibility = campaignMutation({
  args: {
    mapPinId: v.id('mapPins'),
    visible: v.boolean(),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const pin = await ctx.db.get(args.mapPinId)
    if (!pin) {
      throw new Error('Pin not found')
    }

    const rawMap = await ctx.db.get(pin.mapId)
    await requireItemAccess(ctx, args.campaignId, rawMap, PERMISSION_LEVEL.EDIT)

    await ctx.db.patch(args.mapPinId, {
      visible: args.visible,
      updatedAt: Date.now(),
    })

    return args.mapPinId
  },
})

export const removeItemPin = campaignMutation({
  args: {
    mapPinId: v.id('mapPins'),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const pin = await ctx.db.get(args.mapPinId)
    if (!pin) {
      throw new Error('Pin not found')
    }

    const rawMap = await ctx.db.get(pin.mapId)
    await requireItemAccess(ctx, args.campaignId, rawMap, PERMISSION_LEVEL.EDIT)

    await ctx.db.delete(args.mapPinId)
    return args.mapPinId
  },
})
