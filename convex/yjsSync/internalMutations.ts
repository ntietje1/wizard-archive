import { v } from 'convex/values'
import { asyncMap } from 'convex-helpers'
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { snapshotTypeValidator } from '../documentSnapshots/schema'
import { EDIT_HISTORY_ACTION } from '../editHistory/types'
import { createSnapshot } from '../documentSnapshots/functions/createSnapshot'
import { NOTE_SNAPSHOT_TYPE } from '../notes/types'
import { CANVAS_SNAPSHOT_TYPE } from '../canvases/types'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { logger } from '../common/logger'
import { yjsDocumentIdValidator } from './schema'
import { AWARENESS_TTL_MS, SNAPSHOT_MIN_INTERVAL_MS } from './constants'

export const replaceWithSnapshotUpdate = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    updateIds: v.array(v.id('yjsUpdates')),
    update: v.bytes(),
    seq: v.number(),
  },
  handler: async (ctx, { documentId, updateIds, update, seq }) => {
    await asyncMap(updateIds, (updateId) => ctx.db.delete('yjsUpdates', updateId))
    await ctx.db.insert('yjsUpdates', {
      documentId,
      update,
      seq,
      isSnapshot: true,
    })
  },
})

export const createSnapshotFromYjsState = internalMutation({
  args: {
    itemId: v.id('sidebarItems'),
    itemType: sidebarItemTypeValidator,
    snapshotType: snapshotTypeValidator,
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    data: v.bytes(),
  },
  handler: async (ctx, args) => {
    await createSnapshot(ctx, {
      itemId: args.itemId,
      itemType: args.itemType,
      editHistoryId: args.editHistoryId,
      campaignId: args.campaignId,
      snapshotType: args.snapshotType,
      data: args.data,
    })

    await ctx.db.patch('editHistory', args.editHistoryId, { hasSnapshot: true })
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
    await asyncMap(stale, (row) => ctx.db.delete('yjsAwareness', row._id))
  },
})

export const maybeCreateSnapshot = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    triggerSeq: v.number(),
    campaignId: v.id('campaigns'),
    campaignMemberId: v.id('campaignMembers'),
    userId: v.id('userProfiles'),
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
        q.eq('itemId', args.documentId).eq('action', EDIT_HISTORY_ACTION.content_edited),
      )
      .order('desc')
      .first()
    if (
      lastContentEdit &&
      lastContentEdit.campaignMemberId === args.campaignMemberId &&
      Date.now() - lastContentEdit._creationTime < SNAPSHOT_MIN_INTERVAL_MS
    )
      return null

    const doc = await ctx.db.get('sidebarItems', args.documentId)
    if (!doc) return null

    if (doc.type !== SIDEBAR_ITEM_TYPES.notes && doc.type !== SIDEBAR_ITEM_TYPES.canvases) {
      logger.warn(
        `maybeCreateSnapshot: unexpected document type '${(doc as { type: string }).type}' for ${args.documentId}, skipping snapshot`,
      )
      return null
    }

    await ctx.db.patch('sidebarItems', args.documentId, {
      updatedTime: Date.now(),
      updatedBy: args.userId,
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

    await ctx.scheduler.runAfter(0, internal.yjsSync.internalActions.captureSnapshot, {
      documentId: args.documentId,
      itemType: doc.type,
      snapshotType:
        doc.type === SIDEBAR_ITEM_TYPES.notes ? NOTE_SNAPSHOT_TYPE : CANVAS_SNAPSHOT_TYPE,
      editHistoryId,
      campaignId: args.campaignId,
      maxSeq: args.triggerSeq,
    })

    return null
  },
})
