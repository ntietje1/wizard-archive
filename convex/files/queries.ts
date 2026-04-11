import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { fileWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { FileWithContent } from './types'

export const getFile = campaignQuery({
  args: {
    fileId: v.id('sidebarItems'),
  },
  returns: v.nullable(fileWithContentValidator),
  handler: async (ctx, args): Promise<FileWithContent | null> => {
    return (await getSidebarItemWithContent(ctx, args.fileId)) as FileWithContent | null
  },
})
