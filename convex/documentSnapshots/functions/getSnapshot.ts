import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { HISTORY_ROLLBACK_REJECTION_REASON } from '@wizard-archive/editor/resources/history-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { RollbackServerRejectionReason } from '../rollback'

export type HistorySnapshotResolution =
  | {
      status: 'ready'
      historyEntry: Doc<'editHistory'>
      snapshot: Doc<'documentSnapshots'>
    }
  | { status: 'rejected'; reason: RollbackServerRejectionReason }

export async function resolveHistorySnapshot(
  ctx: CampaignQueryCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<HistorySnapshotResolution> {
  const historyEntry = await ctx.db.get('editHistory', editHistoryId)
  if (!historyEntry || historyEntry.campaignId !== ctx.campaign._id) {
    return {
      status: 'rejected',
      reason: HISTORY_ROLLBACK_REJECTION_REASON.historyEntryUnavailable,
    }
  }

  const rawItem = await getSidebarItem(ctx, historyEntry.itemId)
  if (!rawItem) {
    return { status: 'rejected', reason: HISTORY_ROLLBACK_REJECTION_REASON.itemUnavailable }
  }
  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (
    historyEntry.itemType !== RESOURCE_TYPES.notes &&
    historyEntry.itemType !== RESOURCE_TYPES.canvases &&
    historyEntry.itemType !== RESOURCE_TYPES.gameMaps
  ) {
    return {
      status: 'rejected',
      reason: HISTORY_ROLLBACK_REJECTION_REASON.unsupportedItemType,
    }
  }

  const snapshots = await ctx.db
    .query('documentSnapshots')
    .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
    .take(2)
  if (snapshots.length === 0) {
    return { status: 'rejected', reason: HISTORY_ROLLBACK_REJECTION_REASON.snapshotUnavailable }
  }

  const snapshot = snapshots[0]
  if (
    snapshots.length !== 1 ||
    rawItem.id !== historyEntry.itemId ||
    rawItem.type !== historyEntry.itemType ||
    snapshot.itemId !== historyEntry.itemId ||
    snapshot.itemType !== historyEntry.itemType ||
    snapshot.campaignId !== historyEntry.campaignId
  ) {
    return {
      status: 'rejected',
      reason: HISTORY_ROLLBACK_REJECTION_REASON.snapshotIncompatible,
    }
  }

  return { status: 'ready', historyEntry, snapshot }
}
