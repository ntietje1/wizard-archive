import { v } from 'convex/values'
import { asyncMap } from 'convex-helpers'
import { literals } from 'convex-helpers/validators'
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logger } from '../common/logger'
import { yjsDocumentIdValidator } from './schema'
import { SNAPSHOT_MIN_INTERVAL_MS } from './constants'
import { AWARENESS_CLEANUP_BATCH_SIZE, AWARENESS_TTL_MS } from '../../shared/yjs-sync/awareness'
import { DOCUMENT_SNAPSHOT_TYPE } from '../documentSnapshots/types'
import { logEditHistory } from '../editHistory/log'
import { getYjsDocumentRevision } from './functions/documentRevision'
import {
  SNAPSHOT_CAPTURE_REJECTION_REASON,
  snapshotCaptureResultValidator,
} from './snapshotCapture'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { SnapshotCaptureResult } from './snapshotCapture'

export const replaceWithSnapshotUpdate = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    updateIds: v.array(v.id('yjsUpdates')),
    update: v.bytes(),
    seq: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { documentId, updateIds, update, seq }) => {
    const latestContentEdit = await ctx.db
      .query('editHistory')
      .withIndex('by_item_action', (q) =>
        q.eq('itemId', documentId).eq('action', EDIT_HISTORY_ACTION.content_edited),
      )
      .order('desc')
      .first()
    if (latestContentEdit && !latestContentEdit.hasSnapshot) return null

    await asyncMap(updateIds, (updateId) => ctx.db.delete('yjsUpdates', updateId))
    await ctx.db.insert('yjsUpdates', {
      documentId,
      update,
      seq,
      isSnapshot: true,
    })
    return null
  },
})

type CommitYjsSnapshotCaptureArgs = {
  itemId: Id<'sidebarItems'>
  itemType: typeof RESOURCE_TYPES.notes | typeof RESOURCE_TYPES.canvases
  editHistoryId: Id<'editHistory'>
  campaignId: Id<'campaigns'>
  expectedRevision: number
  data: ArrayBuffer
}

export const commitYjsSnapshotCapture = internalMutation({
  args: {
    itemId: v.id('sidebarItems'),
    itemType: literals(RESOURCE_TYPES.notes, RESOURCE_TYPES.canvases),
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    expectedRevision: v.number(),
    data: v.bytes(),
  },
  returns: snapshotCaptureResultValidator,
  handler: commitYjsSnapshotCaptureHandler,
})

async function commitYjsSnapshotCaptureHandler(
  ctx: MutationCtx,
  args: CommitYjsSnapshotCaptureArgs,
): Promise<SnapshotCaptureResult> {
  const [item, historyEntry, revision, snapshots] = await Promise.all([
    ctx.db.get('sidebarItems', args.itemId),
    ctx.db.get('editHistory', args.editHistoryId),
    getYjsDocumentRevision(ctx, args.itemId),
    ctx.db
      .query('documentSnapshots')
      .withIndex('by_editHistory', (q) => q.eq('editHistoryId', args.editHistoryId))
      .take(2),
  ])

  if (!historyEntry) return rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.historyUnavailable)
  if (!item) {
    await deletePendingCaptureHistory(ctx, historyEntry, args)
    return rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.itemUnavailable)
  }
  if (!captureOwnershipMatches(item, historyEntry, args)) {
    return rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.snapshotIncompatible)
  }
  if (revision !== args.expectedRevision) {
    await deletePendingCaptureHistory(ctx, historyEntry, args)
    return rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.revisionChanged)
  }

  const existingSnapshot = snapshots.length === 1 ? snapshots[0] : null
  if (historyEntry.hasSnapshot) {
    return existingSnapshot && snapshotOwnershipMatches(existingSnapshot, args)
      ? { status: 'captured', snapshotId: existingSnapshot._id }
      : rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.snapshotIncompatible)
  }
  if (snapshots.length > 0) {
    return rejectedCapture(SNAPSHOT_CAPTURE_REJECTION_REASON.snapshotIncompatible)
  }

  const snapshotId = await ctx.db.insert('documentSnapshots', {
    itemId: args.itemId,
    itemType: args.itemType,
    editHistoryId: args.editHistoryId,
    campaignId: args.campaignId,
    snapshotType: DOCUMENT_SNAPSHOT_TYPE.YjsState,
    data: args.data,
  })
  await ctx.db.patch('editHistory', args.editHistoryId, { hasSnapshot: true })
  return { status: 'captured', snapshotId }
}

function captureOwnershipMatches(
  item: Doc<'sidebarItems'>,
  historyEntry: Doc<'editHistory'>,
  args: CommitYjsSnapshotCaptureArgs,
) {
  return (
    item._id === args.itemId &&
    item.type === args.itemType &&
    item.campaignId === args.campaignId &&
    historyEntry.itemId === args.itemId &&
    historyEntry.itemType === args.itemType &&
    historyEntry.campaignId === args.campaignId &&
    historyEntry.action === EDIT_HISTORY_ACTION.content_edited
  )
}

function snapshotOwnershipMatches(
  snapshot: Doc<'documentSnapshots'>,
  args: CommitYjsSnapshotCaptureArgs,
) {
  return (
    snapshot.itemId === args.itemId &&
    snapshot.itemType === args.itemType &&
    snapshot.editHistoryId === args.editHistoryId &&
    snapshot.campaignId === args.campaignId &&
    snapshot.snapshotType === DOCUMENT_SNAPSHOT_TYPE.YjsState
  )
}

async function deletePendingCaptureHistory(
  ctx: MutationCtx,
  historyEntry: Doc<'editHistory'>,
  args: CommitYjsSnapshotCaptureArgs,
) {
  if (!historyEntry.hasSnapshot && captureHistoryMatches(historyEntry, args)) {
    await ctx.db.delete('editHistory', historyEntry._id)
  }
}

function captureHistoryMatches(
  historyEntry: Doc<'editHistory'>,
  args: CommitYjsSnapshotCaptureArgs,
) {
  return (
    historyEntry.itemId === args.itemId &&
    historyEntry.itemType === args.itemType &&
    historyEntry.campaignId === args.campaignId &&
    historyEntry.action === EDIT_HISTORY_ACTION.content_edited
  )
}

function rejectedCapture(
  reason: (typeof SNAPSHOT_CAPTURE_REJECTION_REASON)[keyof typeof SNAPSHOT_CAPTURE_REJECTION_REASON],
): SnapshotCaptureResult {
  return { status: 'rejected', reason }
}

export const cleanupStaleAwareness = internalMutation({
  args: {},
  returns: v.object({ deletedCount: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    const staleThreshold = Date.now() - AWARENESS_TTL_MS
    const stale = await ctx.db
      .query('yjsAwareness')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', staleThreshold))
      .take(AWARENESS_CLEANUP_BATCH_SIZE)
    await asyncMap(stale, (row) => ctx.db.delete('yjsAwareness', row._id))
    const hasMore = stale.length === AWARENESS_CLEANUP_BATCH_SIZE
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.yjsSync.internalMutations.cleanupStaleAwareness, {})
    }
    return { deletedCount: stale.length, hasMore }
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

    if (doc.type !== RESOURCE_TYPES.notes && doc.type !== RESOURCE_TYPES.canvases) {
      logger.warn(
        `maybeCreateSnapshot: unexpected document type '${(doc as { type: string }).type}' for ${args.documentId}, skipping snapshot`,
      )
      return null
    }

    await ctx.db.patch('sidebarItems', args.documentId, {
      updatedTime: Date.now(),
      updatedBy: args.userId,
    })

    const editHistoryId = await logEditHistory(
      {
        db: ctx.db,
        campaign: { _id: args.campaignId },
        membership: { _id: args.campaignMemberId },
      },
      {
        itemId: args.documentId,
        itemType: doc.type,
        action: EDIT_HISTORY_ACTION.content_edited,
      },
    )
    const expectedRevision = await getYjsDocumentRevision(ctx, args.documentId)

    await ctx.scheduler.runAfter(0, internal.yjsSync.internalActions.captureSnapshot, {
      documentId: args.documentId,
      itemType: doc.type,
      editHistoryId,
      campaignId: args.campaignId,
      expectedRevision,
      maxSeq: args.triggerSeq,
    })

    return null
  },
})
