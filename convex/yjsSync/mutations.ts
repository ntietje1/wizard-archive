import { v } from 'convex/values'
import { authMutation } from '../functions'
import { internal } from '../_generated/api'
import { logEditHistory } from '../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../editHistory/types'
import { captureNoteSnapshot } from '../notes/functions/captureNoteSnapshot'
import { captureCanvasSnapshot } from '../canvases/functions/captureCanvasSnapshot'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { yjsDocumentIdValidator } from './schema'
import {
  checkYjsReadAccess,
  checkYjsWriteAccess,
} from './functions/checkYjsAccess'
import { shouldCompact } from './functions/compactUpdates'
import type { Id } from '../_generated/dataModel'

const EDIT_HISTORY_DEBOUNCE_MS = 5 * 60 * 1000

export const pushUpdate = authMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    update: v.bytes(),
  },
  returns: v.object({ seq: v.number() }),
  handler: async (ctx, { documentId, update }) => {
    const doc = await checkYjsWriteAccess(ctx, documentId)

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

    const lastContentEdit = await ctx.db
      .query('editHistory')
      .withIndex('by_item_action', (q) =>
        q
          .eq('itemId', documentId)
          .eq('action', EDIT_HISTORY_ACTION.content_edited),
      )
      .order('desc')
      .first()

    if (
      !lastContentEdit ||
      Date.now() - lastContentEdit._creationTime >= EDIT_HISTORY_DEBOUNCE_MS
    ) {
      const [editHistoryId] = await Promise.all([
        logEditHistory(
          ctx,
          {
            itemId: documentId,
            itemType: doc.type,
            campaignId: doc.campaignId,
            action: EDIT_HISTORY_ACTION.content_edited,
          },
          { hasSnapshot: true },
        ),
        ctx.db.patch(documentId, {
          updatedTime: Date.now(),
          updatedBy: ctx.user.profile._id,
        }),
      ])

      const snapshotArgs = {
        editHistoryId,
        campaignId: doc.campaignId,
        createdBy: ctx.user.profile._id,
      }

      if (doc.type === SIDEBAR_ITEM_TYPES.notes) {
        await captureNoteSnapshot(ctx, {
          noteId: documentId as Id<'notes'>,
          ...snapshotArgs,
        })
      } else {
        await captureCanvasSnapshot(ctx, {
          canvasId: documentId as Id<'canvases'>,
          ...snapshotArgs,
        })
      }
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
