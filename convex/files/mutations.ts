import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { updateFileStorage as updateFileStorageFn } from './functions/updateFile'
import { resourceIdValidator } from '../resources/validators'
import { requireSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

export const updateFileStorage = campaignMutation({
  args: {
    fileId: resourceIdValidator,
    uploadSessionId: v.nullable(v.id('fileStorage')),
  },
  returns: v.object({
    fileId: resourceIdValidator,
  }),
  handler: async (ctx, args): Promise<{ fileId: ResourceId }> => {
    const file = await requireSidebarItemRow(ctx, args.fileId)
    await updateFileStorageFn(ctx, {
      fileId: file._id,
      uploadSessionId: args.uploadSessionId,
    })
    return { fileId: args.fileId }
  },
})
