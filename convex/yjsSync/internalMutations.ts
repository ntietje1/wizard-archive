import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { EDIT_HISTORY_ACTION } from '../editHistory/types'
import { captureNoteSnapshot } from '../notes/functions/captureNoteSnapshot'
import { captureCanvasSnapshot } from '../canvases/functions/captureCanvasSnapshot'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { logger } from '../common/logger'
import { yjsDocumentIdValidator } from './schema'
import { compactUpdates } from './functions/compactUpdates'
import { AWARENESS_TTL_MS, SNAPSHOT_MIN_INTERVAL_MS } from './constants'
import type { Id } from '../_generated/dataModel'

export const compact = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
  },
  handler: async (ctx, { documentId }) => {
    await compactUpdates(ctx, documentId)
  },
})

export const cleanupStaleAwareness = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleThreshold = Date.now() - AWARENESS_TTL_MS
    const stale = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', staleThreshold))
      .collect()
    await Promise.all(stale.map((row) => ctx.db.delete(row._id)))
  },
})

export const maybeCreateSnapshot = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    triggerSeq: v.number(),
    campaignId: v.id('campaigns'),
    campaignMemberId: v.id('campaignMembers'),
    createdBy: v.id('userProfiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', args.documentId))
      .order('desc')
      .first()
    if (!latest || latest.seq !== args.triggerSeq) return null

    const lastContentEdit = await ctx.db
      .query('editHistory')
      .withIndex('by_item_action', (q) =>
        q
          .eq('itemId', args.documentId)
          .eq('action', EDIT_HISTORY_ACTION.content_edited),
      )
      .order('desc')
      .first()
    if (
      lastContentEdit &&
      lastContentEdit.campaignMemberId === args.campaignMemberId &&
      Date.now() - lastContentEdit._creationTime < SNAPSHOT_MIN_INTERVAL_MS
    )
      return null

    const doc = await ctx.db.get(args.documentId)
    if (!doc) return null

    if (
      doc.type !== SIDEBAR_ITEM_TYPES.notes &&
      doc.type !== SIDEBAR_ITEM_TYPES.canvases
    ) {
      logger.warn(
        `maybeCreateSnapshot: unexpected document type '${(doc as { type: string }).type}' for ${args.documentId}, skipping snapshot`,
      )
      return null
    }

    await ctx.db.patch(args.documentId, {
      updatedTime: Date.now(),
      updatedBy: args.createdBy,
    })

    const editHistoryId = await ctx.db.insert('editHistory', {
      itemId: args.documentId,
      itemType: doc.type,
      campaignId: args.campaignId,
      campaignMemberId: args.campaignMemberId,
      action: EDIT_HISTORY_ACTION.content_edited,
      metadata: null,
      hasSnapshot: false,
    })

    const snapshotArgs = {
      editHistoryId,
      campaignId: args.campaignId,
      createdBy: args.createdBy,
    }

    if (doc.type === SIDEBAR_ITEM_TYPES.notes) {
      await captureNoteSnapshot(ctx, {
        noteId: args.documentId as Id<'notes'>,
        ...snapshotArgs,
      })
    } else {
      await captureCanvasSnapshot(ctx, {
        canvasId: args.documentId as Id<'canvases'>,
        ...snapshotArgs,
      })
    }

    await ctx.db.patch(editHistoryId, { hasSnapshot: true })

    return null
  },
})
