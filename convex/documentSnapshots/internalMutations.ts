import { v } from 'convex/values'
import { asyncMap } from 'convex-helpers'
import { campaignInternalMutation } from '../functions'
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { rollbackToSnapshot } from './functions/rollbackToSnapshot'
import { rollbackResultValidator } from './rollback'

const rollbackCurrentStateValidator = v.union(
  v.object({
    kind: v.literal('yjs'),
    data: v.bytes(),
    expectedRevision: v.number(),
    expectedSeq: v.number(),
  }),
  v.object({ kind: v.literal('game-map') }),
)

const ITEM_HISTORY_CLEANUP_BATCH_SIZE = 100

type ItemHistoryCleanupResult = {
  deletedHistoryCount: number
  deletedSnapshotCount: number
  hasMore: boolean
}

export const cleanupItemHistoryBatch = internalMutation({
  args: { itemId: v.id('sidebarItems') },
  returns: v.object({
    deletedHistoryCount: v.number(),
    deletedSnapshotCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, { itemId }): Promise<ItemHistoryCleanupResult> => {
    const [historyEntries, snapshots] = await Promise.all([
      ctx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', itemId))
        .take(ITEM_HISTORY_CLEANUP_BATCH_SIZE),
      ctx.db
        .query('documentSnapshots')
        .withIndex('by_item', (q) => q.eq('itemId', itemId))
        .take(ITEM_HISTORY_CLEANUP_BATCH_SIZE),
    ])
    await Promise.all([
      asyncMap(historyEntries, (entry) => ctx.db.delete('editHistory', entry._id)),
      asyncMap(snapshots, (snapshot) => ctx.db.delete('documentSnapshots', snapshot._id)),
    ])

    const hasMore =
      historyEntries.length === ITEM_HISTORY_CLEANUP_BATCH_SIZE ||
      snapshots.length === ITEM_HISTORY_CLEANUP_BATCH_SIZE
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.documentSnapshots.internalMutations.cleanupItemHistoryBatch,
        { itemId },
      )
    }

    return {
      deletedHistoryCount: historyEntries.length,
      deletedSnapshotCount: snapshots.length,
      hasMore,
    }
  },
})

export const applyRollback = campaignInternalMutation({
  args: {
    currentState: rollbackCurrentStateValidator,
    editHistoryId: v.id('editHistory'),
  },
  returns: rollbackResultValidator,
  handler: async (ctx, args) => await rollbackToSnapshot(ctx, args),
})
