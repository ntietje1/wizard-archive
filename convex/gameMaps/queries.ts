import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { getNote } from "../notes/notes";
import type { GameMap, MapPinWithItem } from './types';
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";
import { mapValidator, mapPinWithItemValidator } from "./schema";
import { getMap as getMapFn } from "./gameMaps";


export const getCampaignMaps = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(mapValidator),
  handler: async (ctx, args): Promise<GameMap[]> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const maps = await ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_category_parent', (q) => q.eq('campaignId', args.campaignId)
      )
      .collect()

    return maps.map((m) => ({
      ...m,
      type: SIDEBAR_ITEM_TYPES.gameMaps,
    }))
  },
})

export const getMap = query({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: mapValidator,
  handler: async (ctx, args): Promise<GameMap> => {
    return getMapFn(ctx, args.mapId)
  },
})

export const getMapPins = query({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.array(mapPinWithItemValidator),
  handler: async (ctx, args): Promise<MapPinWithItem[]> => {
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

    const pinsWithItems = await Promise.all(
      pins.map(async (pin) => {
        if (pin.itemType === SIDEBAR_ITEM_TYPES.notes && pin.noteId) {
          return {
            ...pin,
            itemType: SIDEBAR_ITEM_TYPES.notes,
            item: await getNote(ctx, pin.noteId),
          }
        } else if (pin.itemType === SIDEBAR_ITEM_TYPES.gameMaps && pin.pinnedMapId) {
          return {
            ...pin,
            itemType: SIDEBAR_ITEM_TYPES.gameMaps,
            item: await getMapFn(ctx, pin.pinnedMapId),
          }
        }
        return null
      })
    ).then((pins) => pins.filter((p): p is MapPinWithItem => p !== null))

    return pinsWithItems
  },
})
