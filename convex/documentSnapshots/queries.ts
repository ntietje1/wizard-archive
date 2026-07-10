import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getHistoryPreview as getHistoryPreviewFn } from './functions/getHistoryPreview'
import { historyPreviewValidator } from './historyPreview'

export const getHistoryPreview = campaignQuery({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.nullable(historyPreviewValidator),
  handler: async (ctx, { editHistoryId }) => {
    return await getHistoryPreviewFn(ctx, { editHistoryId })
  },
})
