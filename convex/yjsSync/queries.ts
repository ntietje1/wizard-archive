import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { yjsDocumentIdValidator } from './schema'
import { checkYjsReadAccess } from './functions/checkYjsAccess'

export const getUpdates = campaignQuery({
  args: {
    documentId: yjsDocumentIdValidator,
    afterSeq: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      seq: v.number(),
      update: v.bytes(),
    }),
  ),
  handler: async (ctx, { documentId, afterSeq }) => {
    await checkYjsReadAccess(ctx, documentId)

    const rows = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => {
        const base = q.eq('documentId', documentId)
        return afterSeq !== undefined ? base.gt('seq', afterSeq) : base
      })
      .order('asc')
      .collect()

    return rows.map((row) => ({ seq: row.seq, update: row.update }))
  },
})

export const getAwareness = campaignQuery({
  args: {
    documentId: yjsDocumentIdValidator,
  },
  returns: v.array(
    v.object({
      clientId: v.number(),
      state: v.bytes(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { documentId }) => {
    await checkYjsReadAccess(ctx, documentId)

    const rows = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .collect()

    return rows.map((row) => ({
      clientId: row.clientId,
      state: row.state,
      updatedAt: row.updatedAt,
    }))
  },
})
