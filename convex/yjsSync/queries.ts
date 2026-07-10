import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { campaignQuery } from '../functions'
import { yjsDocumentIdValidator } from './schema'
import { checkYjsReadAccess } from './functions/checkYjsAccess'
import { paginatedQueryResultFields } from '../common/pagination'
import { getYjsDocumentRevision } from './functions/documentRevision'

const yjsUpdatePageEntryValidator = v.object({
  revision: v.number(),
  seq: v.number(),
  update: v.bytes(),
})

const yjsAwarenessPageEntryValidator = v.object({
  clientId: v.number(),
  state: v.bytes(),
  updatedAt: v.number(),
})

export const getUpdates = campaignQuery({
  args: {
    documentId: yjsDocumentIdValidator,
    afterSeq: v.union(v.number(), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(yjsUpdatePageEntryValidator),
    ...paginatedQueryResultFields,
  }),
  handler: async (ctx, { documentId, afterSeq, paginationOpts }) => {
    await checkYjsReadAccess(ctx, documentId)

    const revision = await getYjsDocumentRevision(ctx, documentId)

    const result = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => {
        const base = q.eq('documentId', documentId)
        return afterSeq !== null ? base.gt('seq', afterSeq) : base
      })
      .order('asc')
      .paginate(paginationOpts)

    return {
      ...result,
      page: result.page.map((row) => ({ revision, seq: row.seq, update: row.update })),
    }
  },
})

export const getAwareness = campaignQuery({
  args: {
    documentId: yjsDocumentIdValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(yjsAwarenessPageEntryValidator),
    ...paginatedQueryResultFields,
  }),
  handler: async (ctx, { documentId, paginationOpts }) => {
    await checkYjsReadAccess(ctx, documentId)

    const result = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_document_client', (q) => q.eq('documentId', documentId))
      .order('asc')
      .paginate(paginationOpts)

    return {
      ...result,
      page: result.page.map((row) => ({
        clientId: row.clientId,
        state: row.state,
        updatedAt: row.updatedAt,
      })),
    }
  },
})
