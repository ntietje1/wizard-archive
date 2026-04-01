import { v } from 'convex/values'
import { authQuery } from '../functions'
import { checkYjsReadAccess } from './functions/checkYjsAccess'

export const getUpdates = authQuery({
  args: {
    documentId: v.id('notes'),
  },
  returns: v.array(
    v.object({
      seq: v.number(),
      update: v.bytes(),
    }),
  ),
  handler: async (ctx, { documentId }) => {
    await checkYjsReadAccess(ctx, documentId)

    const rows = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('asc')
      .collect()

    return rows.map((row) => ({ seq: row.seq, update: row.update }))
  },
})

export const getAwareness = authQuery({
  args: {
    documentId: v.id('notes'),
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
