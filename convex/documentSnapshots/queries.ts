import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getHistoryPreview as getHistoryPreviewFn } from './functions/getHistoryPreview'
import { historyPreviewValidator } from './historyPreview'
import { historyEntryIdValidator } from '../editHistory/schema'
import { getHistoryEntryRow, requireHistoryEntryId } from '../editHistory/functions/getHistoryEntry'

export const getHistoryPreview = campaignQuery({
  args: {
    editHistoryId: historyEntryIdValidator,
  },
  returns: v.nullable(historyPreviewValidator),
  handler: async (ctx, { editHistoryId }) => {
    const historyEntry = await getHistoryEntryRow(ctx, requireHistoryEntryId(editHistoryId))
    return historyEntry ? await getHistoryPreviewFn(ctx, { editHistoryId: historyEntry._id }) : null
  },
})
