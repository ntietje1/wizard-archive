import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getTag, getTagCategoryBySlug, getTagsByCategory } from '../tags/tags'
import type { Location } from './types'
import { combineLocationAndTag, getLocation } from './locations'
import { locationValidator } from './schema'
import { SYSTEM_DEFAULT_CATEGORIES } from '../tags/types'

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
