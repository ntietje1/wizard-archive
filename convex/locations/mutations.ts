import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { deleteTag, insertTagAndNote, updateTagAndContent } from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import { getLocation } from './locations'
import type { Id } from '../_generated/dataModel'

export const createLocation = mutation({
  args: {
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.object({
    tagId: v.id('tags'),
    locationId: v.id('locations'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    tagId: Id<'tags'>
    locationId: Id<'locations'>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const { tagId } = await insertTagAndNote(ctx, args)

    const locationId = await ctx.db.insert('locations', {
      campaignId: args.campaignId,
      tagId,
    })

    return { tagId, locationId }
  },
})

export const updateLocation = mutation({
  args: {
    locationId: v.id('locations'),
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
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
      args.name !== undefined ||
      args.iconName !== undefined ||
      args.description !== undefined ||
      args.color !== undefined ||
      args.imageStorageId !== undefined
    ) {
      await updateTagAndContent(ctx, location.tagId, {
        name: args.name,
        iconName: args.iconName,
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

    await deleteTag(ctx, location.tagId)
    await ctx.db.delete(args.locationId)

    return args.locationId
  },
})
