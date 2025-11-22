import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getTag, getTagCategoryBySlug, getTagsByCategory } from '../tags/tags'
import type { Location, Map, MapPinWithLocation } from './types'
import { combineLocationAndTag, getLocation } from './locations'
import { locationValidator, mapPinWithLocationValidator, mapValidator } from './schema'
import { SYSTEM_DEFAULT_CATEGORIES } from '../tags/types'
import { Id } from '../_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const getLocationsByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(locationValidator),
  handler: async (ctx, args): Promise<Location[]> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    ) //TODO: allow players to see locations that have been "introduced" to them

    const category = await getTagCategoryBySlug(
      ctx,
      args.campaignId,
      SYSTEM_DEFAULT_CATEGORIES.Location.slug,
    )
    const tags = await getTagsByCategory(ctx, category._id)
    const locations = await ctx.db
      .query('locations')
      .withIndex('by_campaign_tag', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    const locsByTagId = new Map(locations.map((c) => [c.tagId, c]))

    return tags
      .map((t) => {
        const location = locsByTagId.get(t._id)
        if (!location) {
          console.warn(`Location not found for tag ${t._id}`)
          return null
        }
        return combineLocationAndTag(location, t, category)
      })
      .filter((l) => l !== null)
      .sort((a, b) => b._creationTime - a._creationTime)
  },
})

export const getLocationById = query({
  args: {
    locationId: v.id('locations'),
  },
  returns: locationValidator,
  handler: async (ctx, args): Promise<Location> => {
    const location = await getLocation(ctx, args.locationId)
    if (!location) {
      throw new Error(`Location not found: ${args.locationId}`)
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: location.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    ) //TODO: allow players to see locations that have been "introduced" to them

    return location
  },
})

export const getLocationByTagId = query({
  args: {
    tagId: v.id('tags'),
  },
  returns: locationValidator,
  handler: async (ctx, args): Promise<Location> => {
    const tag = await getTag(ctx, args.tagId)

    await requireCampaignMembership(
      ctx,
      { campaignId: tag.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    ) // TODO: allow players to see locations that have been "introduced" to them

    const category = await getTagCategoryBySlug(
      ctx,
      tag.campaignId,
      SYSTEM_DEFAULT_CATEGORIES.Location.slug,
    )

    const location = await ctx.db
      .query('locations')
      .withIndex('by_campaign_tag', (q) =>
        q.eq('campaignId', tag.campaignId).eq('tagId', tag._id),
      )
      .unique()

    if (!location) {
      throw new Error(`Location not found: ${args.tagId}`)
    }

    return combineLocationAndTag(location, tag, category)
  },
})

export const getCampaignMaps = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(
    v.object({
      _id: v.id('maps'),
      _creationTime: v.number(),
      campaignId: v.id('campaigns'),
      userId: v.id('userProfiles'),
      name: v.optional(v.string()),
      imageStorageId: v.optional(v.id('_storage')),
      categoryId: v.optional(v.id('tagCategories')),
      parentFolderId: v.optional(v.id('folders')),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args): Promise<Map[]> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const maps = await ctx.db
      .query('maps')
      .withIndex('by_campaign_category_parent', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect();

    return maps.map((m) => ({
      ...m,
      type: SIDEBAR_ITEM_TYPES.maps,
    }));
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
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
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
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
      }),
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
