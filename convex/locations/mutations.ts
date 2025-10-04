import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import {
  deleteTagAndCleanupContent,
  getTag,
  insertTagAndNote,
} from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { createTagAndNoteArgs } from '../tags/schema'

export const createLocation = mutation({
  args: {
    ...createTagAndNoteArgs,
  },
  returns: v.object({
    tagId: v.id('tags'),
    noteId: v.id('notes'),
    locationId: v.id('locations'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    tagId: Id<'tags'>
    noteId: Id<'notes'>
    locationId: Id<'locations'>
  }> => {
    const { tagId, noteId } = await insertTagAndNote(ctx, args)
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const locationId = await ctx.db.insert('locations', {
      campaignId: args.campaignId,
      tagId: tagId,
    })

    return { tagId, noteId, locationId }
  },
})

export const updateLocation = mutation({
  args: {
    locationId: v.id('locations'),
  },
  returns: v.id('locations'),
  handler: async (ctx, args): Promise<Id<'locations'>> => {
    const location = await ctx.db.get(args.locationId)
    if (!location) {
      throw new Error('Location not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: location.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    await ctx.db.patch(args.locationId, {
      // put location specific fields here
    })

    return args.locationId
  },
})

export const deleteLocation = mutation({
  args: {
    locationId: v.id('locations'),
  },
  returns: v.id('locations'),
  handler: async (ctx, args): Promise<Id<'locations'>> => {
    const location = await ctx.db.get(args.locationId)
    if (!location) {
      throw new Error('Character not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: location.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    await deleteTagAndCleanupContent(ctx, location.tagId)
    await ctx.db.delete(args.locationId)

    return args.locationId
  },
})
