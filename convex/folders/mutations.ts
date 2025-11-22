import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { deleteNote as deleteNoteFn } from '../notes/notes';
import { getFolderAncestors, getFolder as getFolderFn } from "./folders";


export const deleteFolder = mutation({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const recursiveDelete = async (folderId: Id<'folders'>) => {
      const childFolders = await ctx.db
        .query('folders')
        .withIndex('by_campaign_category_parent', (q) => q
          .eq('campaignId', folder.campaignId)
          .eq('categoryId', folder.categoryId)
          .eq('parentFolderId', folderId)
        )
        .collect()

      const notesInFolder = await ctx.db
        .query('notes')
        .withIndex('by_campaign_category_parent', (q) => q
          .eq('campaignId', folder.campaignId)
          .eq('categoryId', folder.categoryId)
          .eq('parentFolderId', folderId)
        )
        .collect()

      for (const childFolder of childFolders) {
        await recursiveDelete(childFolder._id)
      }

      for (const note of notesInFolder) {
        await deleteNoteFn(ctx, note._id)
      }

      await ctx.db.delete(folderId)
    }

    await recursiveDelete(args.folderId)
    return args.folderId
  },
})

export const updateFolder = mutation({
  args: {
    folderId: v.id('folders'),
    name: v.optional(v.string()),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )
    await ctx.db.patch(args.folderId, { name: args.name })
    return args.folderId
  },
})

export const createFolder = mutation({
  args: {
    name: v.optional(v.string()),
    campaignId: v.optional(v.id('campaigns')),
    categoryId: v.optional(v.id('tagCategories')),
    parentFolderId: v.optional(v.id('folders')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    let campaignId: Id<'campaigns'>
    let parentFolderId: Id<'folders'> | undefined
    let categoryId: Id<'tagCategories'> | undefined

    if (args.parentFolderId) {
      // Creating child folder - inherit categoryId from parent
      const parentFolder = await getFolderFn(ctx, args.parentFolderId)
      campaignId = parentFolder.campaignId
      parentFolderId = args.parentFolderId
      categoryId = parentFolder.categoryId
    } else if (args.campaignId) {
      // Creating root folder
      campaignId = args.campaignId
      parentFolderId = undefined
      categoryId = args.categoryId
    } else {
      throw new Error('Must provide either campaignId or parentFolderId')
    }

    const { identityWithProfile } = await requireCampaignMembership(
      ctx,
      { campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )
    const { profile } = identityWithProfile

    return await ctx.db.insert('folders', {
      userId: profile._id,
      name: args.name || '',
      campaignId,
      updatedAt: Date.now(),
      categoryId: categoryId,
      parentFolderId,
    })
  },
});

export const moveFolder = mutation({
  args: {
    folderId: v.id('folders'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    if (args.parentId) { // disallow moving folder into one of it's own children
      const ancestors = await getFolderAncestors(ctx, args.parentId)
      if (ancestors.some(a => a._id === args.folderId)) {
        throw new Error('Cannot move folder into one of its own children')
      }
    }

    await ctx.db.patch(args.folderId, { parentFolderId: args.parentId })
    return args.folderId
  },
})

