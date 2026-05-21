import { internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { yjsDocumentIdValidator, yjsUpdateValidator } from './schema'

export const listUpdatesForDocument = internalQuery({
  args: {
    documentId: yjsDocumentIdValidator,
  },
  returns: v.array(yjsUpdateValidator),
  handler: async (ctx, { documentId }) => {
    return await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('asc')
      .collect()
  },
})

export const listUpdatesForDocumentThroughSeq = internalQuery({
  args: {
    documentId: yjsDocumentIdValidator,
    maxSeq: v.number(),
  },
  returns: v.array(yjsUpdateValidator),
  handler: async (ctx, { documentId, maxSeq }) => {
    return await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId).lte('seq', maxSeq))
      .order('asc')
      .collect()
  },
})
