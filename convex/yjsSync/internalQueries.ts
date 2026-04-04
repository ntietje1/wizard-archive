import { v } from 'convex/values'
import { internalQuery } from '../_generated/server'
import { yjsDocumentIdValidator } from './schema'

export const getUpdatesInternal = internalQuery({
  args: {
    documentId: yjsDocumentIdValidator,
  },
  returns: v.array(
    v.object({
      seq: v.number(),
      update: v.bytes(),
    }),
  ),
  handler: async (ctx, { documentId }) => {
    const rows = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('asc')
      .collect()

    return rows.map((row) => ({ seq: row.seq, update: row.update }))
  },
})
