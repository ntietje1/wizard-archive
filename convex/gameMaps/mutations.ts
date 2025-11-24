import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { getFolder } from "../folders/folders";
import { getNote } from "../notes/notes";
import { getTagCategory } from "../tags/tags";
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";
import { findUniqueSlug, shortenId } from "../common/slug";


export const createMap = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    imageStorageId: v.id('_storage'),
    categoryId: v.optional(v.id('tagCategories')),
    parentFolderId: v.optional(v.id('folders')),
  },
  returns: v.id('gameMaps'),
  handler: async (ctx, args): Promise<Id<'gameMaps'>> => {
    const { identityWithProfile } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )
    const { profile } = identityWithProfile

    if (args.categoryId) {
      const category = await getTagCategory(
        ctx,
        args.campaignId,
        args.categoryId
      )
      if (!category) {
        throw new Error('Category not found')
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

    return await ctx.db.insert('gameMaps', {
      campaignId: args.campaignId,
      userId: profile._id,
      name: args.name,
      slug: uniqueSlug,
      imageStorageId: args.imageStorageId,
      categoryId: args.categoryId,
      parentFolderId: args.parentFolderId,
      updatedAt: Date.now(),
    })
  },
})

export const updateMap = mutation({
  args: {
    mapId: v.id('gameMaps'),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    parentFolderId: v.optional(v.union(v.id('folders'), v.null())),
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const updates: {
      name?: string
      slug?: string
      imageStorageId?: Id<'_storage'>
      parentFolderId?: Id<'folders'>
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name

      const slugBasis =
        args.name && args.name.trim() !== ''
          ? args.name
          : shortenId(args.mapId)

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
    mapId: v.id('gameMaps'),
    parentFolderId: v.optional(v.id('folders')),
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    
    if (args.parentFolderId) {
        const folder = await getFolder(ctx, args.parentFolderId)
        if (!folder) {
            throw new Error('Folder not found')
        }
        if (folder.campaignId !== map.campaignId) {
            throw new Error('Folder must belong to the same campaign as the map')
        }
    }

    await ctx.db.patch(args.mapId, {
      parentFolderId: args.parentFolderId,
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
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const pins = await ctx.db
        .query('mapPins')
        .withIndex('by_map_itemType', (q) => 
            q.eq('mapId', args.mapId)
        )
        .collect()

    for (const pin of pins) {
      await ctx.db.delete(pin._id)
    }

    await ctx.db.delete(args.mapId)
    return args.mapId
  },
})

export const createItemPin = mutation({
  args: {
    mapId: v.id('gameMaps'),
    x: v.number(),
    y: v.number(),
    iconName: v.string(),
    color: v.optional(v.string()),
    item: v.union(
      v.object({
        itemType: v.literal(SIDEBAR_ITEM_TYPES.notes),
        noteId: v.id('notes'),
      }),
      v.object({
        itemType: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
        mapId: v.id('gameMaps'),
      })
    ),
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    let pinnedItemCampaignId: Id<'campaigns'>

    if (args.item.itemType === SIDEBAR_ITEM_TYPES.notes) {
      const item = args.item
      const note = await getNote(ctx, item.noteId)
      if (!note) {
        throw new Error('Note not found')
      }
      pinnedItemCampaignId = note.campaignId
      if (pinnedItemCampaignId !== map.campaignId) {
        throw new Error('Pinned item and map must belong to the same campaign')
      }
      return await ctx.db.insert('mapPins', {
        mapId: args.mapId,
        itemType: SIDEBAR_ITEM_TYPES.notes,
        noteId: item.noteId,
        iconName: args.iconName,
        color: args.color,
        x: args.x,
        y: args.y,
      })
    } else {
      const item = args.item
      const pinnedMap = await ctx.db.get(item.mapId)
      if (!pinnedMap) {
        throw new Error('Pinned map not found')
      }
      pinnedItemCampaignId = pinnedMap.campaignId
      if (pinnedItemCampaignId !== map.campaignId) {
        throw new Error('Pinned item and map must belong to the same campaign')
      }
      return await ctx.db.insert('mapPins', {
        mapId: args.mapId,
        itemType: SIDEBAR_ITEM_TYPES.gameMaps,
        pinnedMapId: item.mapId,
        iconName: args.iconName,
        color: args.color,
        x: args.x,
        y: args.y,
      })
    }
  },
})

export const updateItemPin = mutation({
  args: {
    mapPinId: v.id('mapPins'),
    x: v.number(),
    y: v.number(),
    iconName: v.string(),
    color: v.optional(v.string())
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    await ctx.db.patch(args.mapPinId, {
      x: args.x,
      y: args.y,
      iconName: args.iconName,
      color: args.color,
    })

    return args.mapPinId
  },
})


export const removeItemPin = mutation({
  args: {
    mapPinId: v.id('mapPins'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {    
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    await ctx.db.delete(args.mapPinId)
    return null
  }
})