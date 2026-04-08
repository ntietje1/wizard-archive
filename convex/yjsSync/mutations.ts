import { v } from 'convex/values'
import { authMutation } from '../functions'
import { internal } from '../_generated/api'
import { yjsDocumentIdValidator } from './schema'
import {
  checkYjsReadAccess,
  checkYjsWriteAccess,
} from './functions/checkYjsAccess'
import { shouldCompact } from './functions/compactUpdates'

export const pushUpdate = authMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    update: v.bytes(),
  },
  returns: v.object({ seq: v.number() }),
  handler: async (ctx, { documentId, update }) => {
    await checkYjsWriteAccess(ctx, documentId)

    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('desc')
      .first()

    const seq = (latest?.seq ?? -1) + 1

    await ctx.db.insert('yjsUpdates', {
      documentId,
      update,
      seq,
      isSnapshot: false,
    })

    if (shouldCompact(seq)) {
      await ctx.scheduler.runAfter(
        0,
        internal.yjsSync.internalMutations.compact,
        { documentId },
      )
    }

    return { seq }
  },
})

export const pushAwareness = authMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    clientId: v.number(),
    state: v.bytes(),
  },
  returns: v.null(),
  handler: async (ctx, { documentId, clientId, state }) => {
    await checkYjsReadAccess(ctx, documentId)

    const existing = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_document_client', (q) =>
        q.eq('documentId', documentId).eq('clientId', clientId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        state,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('yjsAwareness', {
        documentId,
        clientId,
        userId: ctx.user.profile._id,
        state,
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

export const removeAwareness = authMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    clientId: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { documentId, clientId }) => {
    await checkYjsReadAccess(ctx, documentId)

    const existing = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_document_client', (q) =>
        q.eq('documentId', documentId).eq('clientId', clientId),
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    return null
  },
})
