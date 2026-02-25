import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createFile as createFileFn } from './functions/createFile'
import { updateFile as updateFileFn } from './functions/updateFile'
import { moveFile as moveFileFn } from './functions/moveFile'
import { deleteFile as deleteFileFn } from './functions/deleteFile'
import type { Id } from '../_generated/dataModel'

export const moveFile = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    fileId: v.id('files'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    return await moveFileFn(ctx, {
      fileId: args.fileId,
      parentId: args.parentId,
    })
  },
})

export const createFile = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    storageId: v.optional(v.id('_storage')),
    parentId: v.optional(v.id('folders')),
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
    })
  },
})

export const updateFile = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
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

export const deleteFile = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    fileId: v.id('files'),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    return await deleteFileFn(ctx, { fileId: args.fileId })
  },
})
