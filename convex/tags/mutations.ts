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
import { blockNoteIdValidator } from '../blocks/schema'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const createTag = mutation({
  args: createTagAndNoteArgs,
  returns: v.object({
    tagId: v.id('tags'),
  }),
  handler: async (ctx, args): Promise<{ tagId: Id<'tags'> }> => {
    return await insertTagAndNote(ctx, args, args.parentId)
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

    // Tags can only be under categories or folders
    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        tag.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      // Validate that parentId is not a map
      if (parentItem.type === SIDEBAR_ITEM_TYPES.gameMaps) {
        throw new Error('Maps cannot be parents of tags')
      }
      if (
        parentItem.type !== SIDEBAR_ITEM_TYPES.tagCategories &&
        parentItem.type !== SIDEBAR_ITEM_TYPES.folders
      ) {
        throw new Error('Tags can only be children of categories or folders')
      }
    }

    await ctx.db.patch(args.tagId, {
      parentId: args.parentId as
        | Id<'folders'>
        | Id<'tagCategories'>
        | undefined,
    })
    return args.tagId
  },
})

const createTagCategoryNameArgs = v.union(
  v.object({
    categoryName: v.string(),
  }),
  v.object({
    // NOTE: auto-pluralize is currently ALWAYS on in create mode
    name: v.string(),
    pluralName: v.string(),
  }),
)

export const createTagCategory = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: createTagCategoryNameArgs,
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

    if ('categoryName' in args.name) {
      return await insertTagCategory(ctx, {
        campaignId: args.campaignId,
        kind: CATEGORY_KIND.User,
        categoryName: args.name.categoryName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    } else if ('name' in args.name && 'pluralName' in args.name) {
      return await insertTagCategory(ctx, {
        campaignId: args.campaignId,
        kind: CATEGORY_KIND.User,
        name: args.name.name,
        pluralName: args.name.pluralName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    } else {
      throw new Error(
        'Must provide either categoryName or both name and pluralName',
      )
    }
  },
})
export const updateTagCategory = mutation({
  args: {
    categoryId: v.id('tagCategories'),
    categoryName: v.optional(v.string()),
    name: v.optional(v.string()),
    pluralName: v.optional(v.string()),
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
    if (args.categoryName !== undefined) {
      return await updateTagCategoryFn(ctx, args.categoryId, {
        categoryName: args.categoryName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    }
    if (args.name !== undefined && args.pluralName !== undefined) {
      return await updateTagCategoryFn(ctx, args.categoryId, {
        name: args.name,
        pluralName: args.pluralName,
        iconName: args.iconName,
        defaultColor: args.defaultColor,
      })
    }
    throw new Error(
      'Must provide either categoryName or both name and pluralName',
    )
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
