import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { documentSnapshotValidator } from './schema'
import { getSnapshotForHistoryEntry as getSnapshotFn } from './functions/getSnapshot'

export const getSnapshotForHistoryEntry = campaignQuery({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.nullable(documentSnapshotValidator),
  handler: async (ctx, { editHistoryId }) => {
    return await getSnapshotFn(ctx, { editHistoryId })
  },
})
