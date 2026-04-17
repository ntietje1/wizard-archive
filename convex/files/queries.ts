import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { fileWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

export const getFile = campaignQuery({
  args: {
    fileId: v.id('sidebarItems'),
  },
  returns: v.nullable(fileWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.fileId, SIDEBAR_ITEM_TYPES.files)
  },
})
