import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { fileWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { resourceIdValidator } from '../resources/validators'

export const getFile = campaignQuery({
  args: {
    fileId: resourceIdValidator,
  },
  returns: v.nullable(fileWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.fileId, RESOURCE_TYPES.files)
  },
})
