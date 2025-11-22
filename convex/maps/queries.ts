import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { getLocation } from "../locations/locations";
import type { Location } from "../locations/types";
import type { Map, MapPinWithLocation } from './types';
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";
import { mapValidator, mapPinWithLocationValidator } from "./schema";


export const getCampaignMaps = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(mapValidator),
  handler: async (ctx, args): Promise<Map[]> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const maps = await ctx.db
      .query('maps')
      .withIndex('by_campaign_category_parent', (q) => q.eq('campaignId', args.campaignId)
      )
      .collect()

    return maps.map((m) => ({
      ...m,
      type: SIDEBAR_ITEM_TYPES.maps,
    }))
  },
})

export const getMap = query({
  args: {
    mapId: v.id('maps'),
  },
  returns: mapValidator,
  handler: async (ctx, args): Promise<Map> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    return {
      ...map,
      type: SIDEBAR_ITEM_TYPES.maps
    }
  },
})

export const getMapPins = query({
  args: {
    mapId: v.id('maps'),
  },
  returns: v.array(mapPinWithLocationValidator),
  handler: async (ctx, args): Promise<MapPinWithLocation[]> => {
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
      .withIndex('by_map', (q) => q.eq('mapId', args.mapId))
      .collect()

    const pinsWithLocations = await Promise.all(
      pins.map(async (pin) => {
        const location = await getLocation(ctx, pin.locationId)
        if (!location) {
          return null
        }
        return {
          _id: pin._id,
          _creationTime: pin._creationTime,
          mapId: pin.mapId,
          locationId: pin.locationId,
          x: pin.x,
          y: pin.y,
          location,
        }
      })
    )

    return pinsWithLocations.filter((p) => p !== null) as Array<{
      _id: Id<'mapPins'>
      _creationTime: number
      mapId: Id<'maps'>
      locationId: Id<'locations'>
      x: number
      y: number
      location: Location
    }>
  },
})
