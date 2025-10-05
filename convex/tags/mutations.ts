import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CATEGORY_KIND } from './types'
import { Id } from '../_generated/dataModel'
import {
  insertTagAndNote,
  updateTagAndContent,
  insertTagCategory,
  updateTagCategory as updateTagCategoryFn,
  deleteTagAndCleanupContent as deleteTagFn,
  deleteTagCategory as deleteTagCategoryFn,
} from './tags'
import { createTagAndNoteArgs } from './schema'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'

export const createTag = mutation({
  args: createTagAndNoteArgs,
  returns: v.object({
    tagId: v.id('tags'),
    noteId: v.id('notes'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ tagId: Id<'tags'>; noteId: Id<'notes'> }> => {
    return await insertTagAndNote(ctx, args, args.parentFolderId)
  },
})

export const updateTag = mutation({
  args: {
    tagId: v.id('tags'),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.id('tags'),
  handler: async (ctx, args): Promise<Id<'tags'>> => {
    await updateTagAndContent(ctx, args.tagId, {
      displayName: args.displayName,
      color: args.color,
      description: args.description,
    })

    return args.tagId
  },
})

export const deleteTag = mutation({
  args: {
    tagId: v.id('tags'),
  },
  returns: v.id('tags'),
  handler: async (ctx, args): Promise<Id<'tags'>> => {
    return await deleteTagFn(ctx, args.tagId)
  },
})

export const createTagCategory = mutation({
  args: {
    campaignId: v.id('campaigns'),
    displayName: v.string(),
  },
  returns: v.id('tagCategories'),
  handler: async (ctx, args): Promise<Id<'tagCategories'>> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    return await insertTagCategory(ctx, {
      campaignId: args.campaignId,
      kind: CATEGORY_KIND.User,
      displayName: args.displayName,
    })
  },
})
export const updateTagCategory = mutation({
  args: {
    categoryId: v.id('tagCategories'),
    displayName: v.string(),
  },
  returns: v.id('tagCategories'),
  handler: async (ctx, args): Promise<Id<'tagCategories'>> => {
    return await updateTagCategoryFn(ctx, args.categoryId, {
      displayName: args.displayName,
    })
  },
})
export const deleteTagCategory = mutation({
  args: {
    categoryId: v.id('tagCategories'),
  },
  returns: v.id('tagCategories'),
  handler: async (ctx, args): Promise<Id<'tagCategories'>> => {
    return await deleteTagCategoryFn(ctx, args.categoryId)
  },
})
