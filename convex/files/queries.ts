import { v } from 'convex/values'
import { authQuery } from '../functions'
import { fileWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { FileWithContent } from './types'

export const getFile = authQuery({
  args: {
    fileId: v.id('sidebarItems'),
  },
  returns: v.union(fileWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<FileWithContent | null> => {
    return (await getSidebarItemWithContent(ctx, args.fileId)) as FileWithContent | null
  },
})
