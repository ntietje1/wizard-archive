import { v } from 'convex/values'
import { authMutation } from '../functions'
import { createFolder as createFolderFn } from './functions/createFolder'
import { updateFolder as updateFolderFn } from './functions/updateFolder'
import { deleteFolder as deleteFolderFn } from './functions/deleteFolder'
import type { Id } from '../_generated/dataModel'

export const updateFolder = authMutation({
  args: {
    folderId: v.id('folders'),
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
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
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const deleteFolder = authMutation({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    return await deleteFolderFn(ctx, { folderId: args.folderId })
  },
})

export const createFolder = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.union(v.id('folders'), v.null()),
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
      campaignId: args.campaignId,
    })
  },
})
