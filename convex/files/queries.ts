import { v } from 'convex/values'
import { query } from '../_generated/server'
import { fileValidator } from './schema'
import { getFileBySlug as getFileBySlugFn, getFile as getFileFn } from './files'
import type { File } from './types'

export const getFileDownloadUrl = query({
  args: {
    fileId: v.id('files'),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args): Promise<string | null> => {
    const file = await getFileFn(ctx, args.fileId)
    return await ctx.storage.getUrl(file.storageId)
  },
})

export const getFile = query({
  args: {
    fileId: v.id('files'),
  },
  returns: fileValidator,
  handler: async (ctx, args): Promise<File> => {
    return getFileFn(ctx, args.fileId)
  },
})

export const getFileBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    slug: v.string(),
  },
  returns: v.union(fileValidator, v.null()),
  handler: async (ctx, args): Promise<File | null> => {
    return getFileBySlugFn(ctx, args.campaignId, args.slug)
  },
})
