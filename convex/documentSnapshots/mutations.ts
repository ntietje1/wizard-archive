import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { rollbackToSnapshot as rollbackFn } from './functions/rollbackToSnapshot'

export const rollbackToSnapshot = campaignMutation({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.null(),
  handler: async (ctx, { editHistoryId }) => {
    await rollbackFn(ctx, { editHistoryId })
    return null
  },
})
