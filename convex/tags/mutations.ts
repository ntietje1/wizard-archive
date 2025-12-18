import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CATEGORY_KIND } from './types'
import { Id } from '../_generated/dataModel'
import {
  insertTagAndNote,
  updateTagAndContent,
  insertTagCategory,
  updateTagCategory as updateTagCategoryFn,
  deleteTag as deleteTagFn,
  deleteTagCategory as deleteTagCategoryFn,
  removeTagFromBlockHandler,
  addTagToBlockHandler,
} from './tags'
import { createTagAndNoteArgs } from './schema'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { blockNoteIdValidator } from '../blocks/schema'
import {
  getSidebarItemById,
  isValidSidebarParent,
} from '../sidebarItems/sidebarItems'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const createTag = mutation({
  args: createTagAndNoteArgs,
  returns: v.object({
    tagId: v.id('tags'),
  }),
  handler: async (ctx, args): Promise<{ tagId: Id<'tags'> }> => {
    return await insertTagAndNote(ctx, args)
  },
})

export const updateTag = mutation({
  args: {
    tagId: v.id('tags'),
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
  },
  returns: v.id('tags'),
  handler: async (ctx, args): Promise<Id<'tags'>> => {
    await updateTagAndContent(ctx, args.tagId, {
      name: args.name,
      iconName: args.iconName,
      color: args.color,
      description: args.description,
      imageStorageId: args.imageStorageId,
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

export const moveTag = mutation({
  args: {
    tagId: v.id('tags'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.id('tags'),
  handler: async (ctx, args): Promise<Id<'tags'>> => {
    const tag = await ctx.db.get(args.tagId)
    if (!tag) {
      throw new Error('Tag not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: tag.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        tag.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.tags, parentItem.type)) {
        throw new Error(`Invalid parent type: ${parentItem.type}`)
      }
    }

    await ctx.db.patch(args.tagId, {
      parentId: args.parentId,
    })
    return args.tagId
  },
})

export const createTagCategory = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
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

    return await insertTagCategory(ctx, {
      campaignId: args.campaignId,
      kind: CATEGORY_KIND.User,
      name: args.name,
      iconName: args.iconName,
      defaultColor: args.defaultColor,
    })
  },
})
export const updateTagCategory = mutation({
  args: {
    categoryId: v.id('tagCategories'),
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
    defaultColor: v.optional(v.string()),
  },
  returns: v.object({
    categoryId: v.id('tagCategories'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ categoryId: Id<'tagCategories'>; slug: string }> => {
    return await updateTagCategoryFn(ctx, args.categoryId, {
      name: args.name,
      iconName: args.iconName,
      defaultColor: args.defaultColor,
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
