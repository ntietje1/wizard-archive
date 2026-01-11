import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { mapValidator } from './schema'
import { mapPinWithItemValidator } from './validators'
import { getMap as getMapFn } from './gameMaps'
import type { GameMap, MapPinWithItem } from './types'

export const getCampaignMaps = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(mapValidator),
  handler: async (ctx, args): Promise<Array<GameMap>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const maps = await ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    return maps
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

export const getMapDownloadUrl = query({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args): Promise<string | null> => {
    const map = await getMapFn(ctx, args.mapId)
    if (!map.imageStorageId) {
      return null
    }
    return await ctx.storage.getUrl(map.imageStorageId)
  },
})

export const getMapPins = query({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.array(mapPinWithItemValidator),
  handler: async (ctx, args): Promise<Array<MapPinWithItem>> => {
    const map = await ctx.db.get(args.mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const pins = await ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', args.mapId))
      .collect()

    const pinsWithItems = await Promise.all(
      pins.map(async (pin) => {
        const item = await getSidebarItemById(ctx, map.campaignId, pin.itemId)
        if (!item) {
          throw new Error('Item not found')
        }
        return {
          ...pin,
          item,
        }
      }),
    )

    return pinsWithItems
  },
})
