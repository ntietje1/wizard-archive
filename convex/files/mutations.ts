import { v } from 'convex/values'
import { authMutation } from '../functions'
import { createFile as createFileFn } from './functions/createFile'
import { updateFile as updateFileFn } from './functions/updateFile'
import { deleteFile as deleteFileFn } from './functions/deleteFile'
import type { Id } from '../_generated/dataModel'

export const createFile = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    storageId: v.optional(v.id('_storage')),
    parentId: v.union(v.id('folders'), v.null()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    fileId: v.id('files'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileId: Id<'files'>; slug: string }> => {
    return await createFileFn(ctx, {
      name: args.name,
      storageId: args.storageId,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      campaignId: args.campaignId,
    })
  },
})

export const updateFile = authMutation({
  args: {
    fileId: v.id('files'),
    name: v.optional(v.string()),
    storageId: v.optional(v.union(v.id('_storage'), v.null())),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    fileId: v.id('files'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileId: Id<'files'>; slug: string }> => {
    return await updateFileFn(ctx, {
      fileId: args.fileId,
      name: args.name,
      storageId: args.storageId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const deleteFile = authMutation({
  args: {
    fileId: v.id('files'),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    return await deleteFileFn(ctx, { fileId: args.fileId })
  },
})
