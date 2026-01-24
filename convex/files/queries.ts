import { v } from 'convex/values'
import { query } from '../_generated/server'
import { fileWithContentValidator } from './schema'
import { getFile as getFileFn } from './files'
import type { FileWithContent } from './types'

export const getFile = query({
  args: {
    fileId: v.id('files'),
  },
  returns: v.union(fileWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<FileWithContent | null> => {
    return getFileFn(ctx, args.fileId)
  },
})
