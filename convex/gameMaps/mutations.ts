import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import {
  validateParentChange,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import {
  findUniqueGameMapSlug,
  findUniqueSlug,
  resolveSlugBasis,
} from '../common/slug'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  requireEditPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { deleteMap as deleteMapFn } from './gameMaps'
import type { Doc, Id } from '../_generated/dataModel'

export const createMap = mutation({
  args: {
    campaignId: v.id('campaigns'),
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
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        args.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

    const uniqueSlug = await findUniqueSlug(
      resolveSlugBasis(args.name),
      async (slug) => {
        const conflict = await ctx.db
          .query('gameMaps')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null
      },
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

export const updateMap = mutation({
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
    if (!rawMap) {
      throw new Error('Map not found')
    }

    const map = await enhanceSidebarItem(ctx, rawMap)
    await requireFullAccessPermission(ctx, map)

    const updates: Partial<Doc<'gameMaps'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateSidebarItemName({
        ctx,
        campaignId: map.campaignId,
        parentId: map.parentId,
        name: args.name,
        excludeId: map._id,
      })

      updates.slug = await findUniqueGameMapSlug(
        ctx,
        map.campaignId,
        args.name,
        args.mapId,
      )
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

export const moveMap = mutation({
  args: {
    mapId: v.id('gameMaps'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    const rawMap = await ctx.db.get(args.mapId)
    if (!rawMap) {
      throw new Error('Map not found')
    }

    const map = await enhanceSidebarItem(ctx, rawMap)
    await requireFullAccessPermission(ctx, map)

    // Validate no circular parent reference
    await validateParentChange({
      ctx,
      item: map,
      newParentId: args.parentId,
    })

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        map.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }

    // Validate name doesn't conflict in new location
    await validateSidebarItemName({
      ctx,
      campaignId: map.campaignId,
      parentId: args.parentId,
      name: map.name,
      excludeId: map._id,
    })

    await ctx.db.patch(args.mapId, {
      parentId: args.parentId,
      updatedAt: Date.now(),
    })
    return args.mapId
  },
})

export const deleteMap = mutation({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    return await deleteMapFn(ctx, args.mapId)
  },
})

export const createItemPin = mutation({
  args: {
    mapId: v.id('gameMaps'),
    x: v.number(),
    y: v.number(),
    itemId: sidebarItemIdValidator,
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const rawMap = await ctx.db.get(args.mapId)
    if (!rawMap) {
      throw new Error('Map not found')
    }

    const map = await enhanceSidebarItem(ctx, rawMap)
    await requireEditPermission(ctx, map)

    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new Error('Item not found')
    }
    return await ctx.db.insert('mapPins', {
      mapId: args.mapId,
      itemId: args.itemId,
      x: args.x,
      y: args.y,
      updatedAt: Date.now(),
    })
  },
})

export const updateItemPin = mutation({
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
    if (!rawMap) {
      throw new Error('Map not found')
    }

    const map = await enhanceSidebarItem(ctx, rawMap)
    await requireEditPermission(ctx, map)

    await ctx.db.patch(args.mapPinId, {
      x: args.x,
      y: args.y,
      updatedAt: Date.now(),
    })

    return args.mapPinId
  },
})

export const removeItemPin = mutation({
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
    if (!rawMap) {
      throw new Error('Map not found')
    }

    const map = await enhanceSidebarItem(ctx, rawMap)
    await requireEditPermission(ctx, map)

    await ctx.db.delete(args.mapPinId)
    return args.mapPinId
  },
})
