import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { purgeExpiredTrash as purgeExpiredTrashFn } from './functions/purgeExpiredTrash'

export const purgeExpiredTrash = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<void> => {
    return purgeExpiredTrashFn(ctx)
  },
})
