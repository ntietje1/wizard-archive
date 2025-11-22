import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { getFolder } from "../folders/folders";
import { getLocation } from "../locations/locations";
import { getTagCategory } from "../tags/tags";
import { SYSTEM_DEFAULT_CATEGORIES } from "../tags/types";


export const createMap = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    imageStorageId: v.id('_storage'),
    categoryId: v.optional(v.id('tagCategories')),
    parentFolderId: v.optional(v.id('folders')),
  },
  returns: v.id('maps'),
  handler: async (ctx, args): Promise<Id<'maps'>> => {
    const { identityWithProfile } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )
    const { profile } = identityWithProfile

    // enforce only location category (might change this in the future)
    if (!args.categoryId) {
      throw new Error('Category ID is required for creating a map')
    } else {
      const category = await getTagCategory(
        ctx,
        args.campaignId,
        args.categoryId
      )
      if (!category) {
        throw new Error('Category not found')
      }
      if (category.slug !== SYSTEM_DEFAULT_CATEGORIES.Location.slug) {
        throw new Error('Category is not a location category')
      }
    }

    if (args.parentFolderId) {
      const folder = await getFolder(ctx, args.parentFolderId)
      if (!folder) {
        throw new Error('Folder not found')
      }
      if (folder.campaignId !== args.campaignId) {
        throw new Error('Folder must belong to the same campaign as the map')
      }
    }

    return await ctx.db.insert('maps', {
      campaignId: args.campaignId,
      userId: profile._id,
      name: args.name,
      imageStorageId: args.imageStorageId,
      categoryId: args.categoryId,
      parentFolderId: args.parentFolderId,
      updatedAt: Date.now(),
    })
  },
})

export const updateMap = mutation({
  args: {
    mapId: v.id('maps'),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    parentFolderId: v.optional(v.union(v.id('folders'), v.null())),
  },
  returns: v.id('maps'),
  handler: async (ctx, args): Promise<Id<'maps'>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const updates: {
      name?: string
      imageStorageId?: Id<'_storage'>
      parentFolderId?: Id<'folders'>
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
    }
    if (args.imageStorageId !== undefined) {
      updates.imageStorageId = args.imageStorageId
    }
    if (args.parentFolderId !== undefined) {
      updates.parentFolderId = args.parentFolderId ?? undefined
      if (args.parentFolderId) {
        const folder = await getFolder(ctx, args.parentFolderId)
        if (!folder) {
          throw new Error('Folder not found')
        }
        if (folder.campaignId !== map.campaignId) {
          throw new Error('Folder must belong to the same campaign as the map')
        }
      }
    }

    await ctx.db.patch(args.mapId, updates)
    return args.mapId
  },
})

export const moveMap = mutation({
  args: {
    mapId: v.id('maps'),
    parentFolderId: v.optional(v.id('folders')),
  },
  returns: v.id('maps'),
  handler: async (ctx, args): Promise<Id<'maps'>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    await ctx.db.patch(args.mapId, {
      parentFolderId: args.parentFolderId,
      updatedAt: Date.now(),
    })
    return args.mapId
  },
})

export const deleteMap = mutation({
  args: {
    mapId: v.id('maps'),
  },
  returns: v.id('maps'),
  handler: async (ctx, args): Promise<Id<'maps'>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    // Delete all pins for this map
    const pins = await ctx.db
      .query('mapPins')
      .withIndex('by_map', (q) => q.eq('mapId', args.mapId))
      .collect()

    for (const pin of pins) {
      await ctx.db.delete(pin._id)
    }

    await ctx.db.delete(args.mapId)
    return args.mapId
  },
})

export const setLocationPin = mutation({
  args: {
    mapId: v.id('maps'),
    locationId: v.id('locations'),
    x: v.number(),
    y: v.number(),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    const location = await getLocation(ctx, args.locationId)
    if (!location) {
      throw new Error('Location not found')
    }

    if (location.campaignId !== map.campaignId) {
      throw new Error('Location and map must belong to the same campaign')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    // Check if pin already exists
    const existingPin = await ctx.db
      .query('mapPins')
      .withIndex('by_map_location', (q) => q.eq('mapId', args.mapId).eq('locationId', args.locationId)
      )
      .unique()

    if (existingPin) {
      // Update existing pin
      await ctx.db.patch(existingPin._id, {
        x: args.x,
        y: args.y,
      })
      return existingPin._id
    } else {
      // Create new pin
      return await ctx.db.insert('mapPins', {
        mapId: args.mapId,
        locationId: args.locationId,
        x: args.x,
        y: args.y,
      })
    }
  },
})

export const removeLocationPin = mutation({
  args: {
    mapId: v.id('maps'),
    locationId: v.id('locations'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const pin = await ctx.db
      .query('mapPins')
      .withIndex('by_map_location', (q) => q.eq('mapId', args.mapId).eq('locationId', args.locationId)
      )
      .unique()

    if (pin) {
      await ctx.db.delete(pin._id)
    }

    return null
  },
})

export const updatePinCoordinates = mutation({
  args: {
    pinId: v.id('mapPins'),
    x: v.number(),
    y: v.number(),
  },
  returns: v.id('mapPins'),
  handler: async (ctx, args): Promise<Id<'mapPins'>> => {
    const pin = await ctx.db.get(args.pinId)
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    await ctx.db.patch(args.pinId, {
      x: args.x,
      y: args.y,
    })

    return args.pinId
  },
})
