import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { campaignQuery } from '../functions'
import { checkYjsReadAccess } from './functions/checkYjsAccess'
import { paginatedQueryResultFields } from '../common/pagination'
import { getYjsDocumentRevision } from './functions/documentRevision'
import { resourceIdValidator } from '../resources/validators'

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
    documentId: resourceIdValidator,
    afterSeq: v.union(v.number(), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(yjsUpdatePageEntryValidator),
    ...paginatedQueryResultFields,
  }),
  handler: async (ctx, { documentId, afterSeq, paginationOpts }) => {
    const providerDocumentId = await checkYjsReadAccess(ctx, documentId)

    const revision = await getYjsDocumentRevision(ctx, providerDocumentId)

    const result = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => {
        const base = q.eq('documentId', providerDocumentId)
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
    documentId: resourceIdValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(yjsAwarenessPageEntryValidator),
    ...paginatedQueryResultFields,
  }),
  handler: async (ctx, { documentId, paginationOpts }) => {
    const providerDocumentId = await checkYjsReadAccess(ctx, documentId)

    const result = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_document_client', (q) => q.eq('documentId', providerDocumentId))
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
