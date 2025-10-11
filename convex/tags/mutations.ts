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
  removeTagFromBlockHandler,
  addTagToBlockHandler,
} from './tags'
import { createTagAndNoteArgs } from './schema'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { blockNoteIdValidator } from '../notes/schema'

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
    categoryName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    pluralDisplayName: v.optional(v.string()),
    iconName: v.string(),
    defaultColor: v.optional(v.string()),
  },
  returns: v.id('tagCategories'),
  handler: async (ctx, args): Promise<Id<'tagCategories'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Either categoryName (auto-pluralize) or both displayName and pluralDisplayName (manual) must be provided
    if (args.categoryName) {
      return await insertTagCategory(ctx, {
        campaignId: args.campaignId,
        kind: CATEGORY_KIND.User,
        categoryName: args.categoryName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    } else if (args.displayName && args.pluralDisplayName) {
      return await insertTagCategory(ctx, {
        campaignId: args.campaignId,
        kind: CATEGORY_KIND.User,
        displayName: args.displayName,
        pluralDisplayName: args.pluralDisplayName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    } else {
      throw new Error(
        'Must provide either categoryName or both displayName and pluralDisplayName',
      )
    }
  },
})
export const updateTagCategory = mutation({
  args: {
    categoryId: v.id('tagCategories'),
    categoryName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    pluralDisplayName: v.optional(v.string()),
  },
  returns: v.id('tagCategories'),
  handler: async (ctx, args): Promise<Id<'tagCategories'>> => {
    return await updateTagCategoryFn(ctx, args.categoryId, {
      categoryName: args.categoryName,
      displayName: args.displayName,
      pluralDisplayName: args.pluralDisplayName,
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

export const addTagToBlock = mutation({
  args: {
    noteId: v.id('notes'),
    blockId: blockNoteIdValidator,
    tagId: v.id('tags'),
  },
  returns: blockNoteIdValidator,
  handler: async (ctx, args): Promise<string> => {
    return await addTagToBlockHandler(
      ctx,
      args.noteId,
      args.blockId,
      args.tagId,
    )
  },
})

export const removeTagFromBlock = mutation({
  args: {
    noteId: v.id('notes'),
    blockId: blockNoteIdValidator,
    tagId: v.id('tags'),
  },
  returns: blockNoteIdValidator,
  handler: async (ctx, args): Promise<string> => {
    return await removeTagFromBlockHandler(
      ctx,
      args.noteId,
      args.blockId,
      args.tagId,
    )
  },
})
