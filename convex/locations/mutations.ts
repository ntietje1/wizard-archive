import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import {
  deleteTagAndCleanupContent,
  getTag,
  insertTagAndNote,
  updateTagAndContent,
} from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { createTagAndNoteArgs } from '../tags/schema'
import { getLocation } from './locations'

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
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const { tagId, noteId } = await insertTagAndNote(ctx, args)

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
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.id('_storage')),
  },
  returns: v.id('locations'),
  handler: async (ctx, args): Promise<Id<'locations'>> => {
    const location = await getLocation(ctx, args.locationId)
    if (!location) {
      throw new Error('Location not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: location.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Update tag fields if provided
    if (
      args.displayName !== undefined ||
      args.description !== undefined ||
      args.color !== undefined ||
      args.imageStorageId !== undefined
    ) {
      await updateTagAndContent(ctx, location.tagId, {
        displayName: args.displayName,
        description: args.description,
        color: args.color,
        imageStorageId: args.imageStorageId,
      })
    }

    return args.locationId
  },
})

export const deleteLocation = mutation({
  args: {
    locationId: v.id('locations'),
  },
  returns: v.id('locations'),
  handler: async (ctx, args): Promise<Id<'locations'>> => {
    const location = await getLocation(ctx, args.locationId)
    if (!location) {
      throw new Error('Location not found')
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
