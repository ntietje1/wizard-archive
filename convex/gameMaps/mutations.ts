import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getSidebarItemById,
  isValidSidebarParent,
  validateUniqueNameUnderParent,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { findUniqueSlug, shortenId } from '../common/slug'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import { deleteMap as deleteMapFn } from './gameMaps'
import type { Doc, Id } from '../_generated/dataModel'

export const createMap = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    imageStorageId: v.id('_storage'),
    parentId: v.optional(sidebarItemIdValidator),
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
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.gameMaps, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }

    await validateUniqueNameUnderParent(
      ctx,
      args.campaignId,
      args.parentId,
      args.name,
    )

    const slugBasis =
      args.name && args.name.trim() !== '' ? args.name : crypto.randomUUID()

    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', args.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    const mapId = await ctx.db.insert('gameMaps', {
      campaignId: args.campaignId,
      name: args.name,
      slug: uniqueSlug,
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
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const updates: Partial<Doc<'gameMaps'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateUniqueNameUnderParent(
        ctx,
        map.campaignId,
        map.parentId,
        args.name,
        map._id,
      )

      const slugBasis =
        args.name && args.name.trim() !== '' ? args.name : shortenId(args.mapId)

      const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('gameMaps')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', map.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== args.mapId
      })

      updates.slug = uniqueSlug
    }
    if (args.imageStorageId !== undefined) {
      updates.imageStorageId = args.imageStorageId
    }
    if (args.iconName !== undefined) {
      updates.iconName = args.iconName ?? undefined
    }
    if (args.color !== undefined) {
      updates.color = args.color ?? undefined
    }
    await ctx.db.patch(args.mapId, updates)
    return { mapId: args.mapId, slug: updates.slug || map.slug }
  },
})

export const moveMap = mutation({
  args: {
    mapId: v.id('gameMaps'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        map.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.gameMaps, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }

    await validateUniqueNameUnderParent(
      ctx,
      map.campaignId,
      args.parentId,
      map.name,
      map._id,
    )

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
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }
    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

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

    const map = await ctx.db.get(pin.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

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

    const map = await ctx.db.get(pin.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    await ctx.db.delete(args.mapPinId)
    return args.mapPinId
  },
})
