import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { internal } from '../_generated/api'
import { yjsDocumentIdValidator } from './schema'
import { checkYjsReadAccess, checkYjsWriteAccess } from './functions/checkYjsAccess'
import { shouldCompact } from './functions/compactUpdates'
import { SNAPSHOT_IDLE_MS } from './constants'

export const pushUpdate = campaignMutation({
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
      documentId: documentId,
      update,
      seq,
      isSnapshot: false,
    })

    if (shouldCompact(seq)) {
      await ctx.scheduler.runAfter(0, internal.yjsSync.internalMutations.compact, { documentId })
    }

    await ctx.scheduler.runAfter(
      SNAPSHOT_IDLE_MS,
      internal.yjsSync.internalMutations.maybeCreateSnapshot,
      {
        documentId,
        triggerSeq: seq,
        campaignId: ctx.campaign._id,
        campaignMemberId: ctx.membership._id,
        createdBy: ctx.membership.userId,
      },
    )

    return { seq }
  },
})

export const pushAwareness = campaignMutation({
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
      await ctx.db.patch('yjsAwareness', existing._id, {
        state,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('yjsAwareness', {
        documentId: documentId,
        clientId,
        userId: ctx.membership.userId,
        state,
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

export const removeAwareness = campaignMutation({
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
      await ctx.db.delete('yjsAwareness', existing._id)
    }

    return null
  },
})
