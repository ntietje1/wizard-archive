import { v } from 'convex/values'
import { authQuery } from '../functions'
import { fileWithContentValidator } from './schema'
import { getFile as getFileFn } from './functions/getFile'
import type { FileWithContent } from './types'

export const getFile = authQuery({
  args: {
    fileId: v.id('sidebarItems'),
  },
  returns: v.union(fileWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<FileWithContent | null> => {
    return getFileFn(ctx, { fileId: args.fileId })
  },
})
