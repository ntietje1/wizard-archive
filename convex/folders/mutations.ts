import { v } from 'convex/values'
import { campaignMutation, dmMutation } from '../functions'
import { createFolder as createFolderFn } from './functions/createFolder'
import { updateFolder as updateFolderFn } from './functions/updateFolder'
import { moveFolder as moveFolderFn } from './functions/moveFolder'
import { deleteFolder as deleteFolderFn } from './functions/deleteFolder'
import type { Id } from '../_generated/dataModel'

export const updateFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
    name: v.optional(v.string()),
  },
  returns: v.object({
    folderId: v.id('folders'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: Id<'folders'>; slug: string }> => {
    return await updateFolderFn(ctx, {
      folderId: args.folderId,
      name: args.name,
    })
  },
})

export const moveFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    return await moveFolderFn(ctx, {
      folderId: args.folderId,
      parentId: args.parentId,
    })
  },
})

export const deleteFolder = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    return await deleteFolderFn(ctx, { folderId: args.folderId })
  },
})

export const createFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.optional(v.id('folders')),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    folderId: v.id('folders'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: Id<'folders'>; slug: string }> => {
    return await createFolderFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
