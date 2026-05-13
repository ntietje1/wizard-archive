import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { updateFileStorage as updateFileStorageFn } from './functions/updateFile'
import type { Id } from '../_generated/dataModel'

export const updateFileStorage = campaignMutation({
  args: {
    fileId: v.id('sidebarItems'),
    storageId: v.nullable(v.id('_storage')),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'> }> => {
    return await updateFileStorageFn(ctx, {
      fileId: args.fileId,
      storageId: args.storageId,
    })
  },
})
