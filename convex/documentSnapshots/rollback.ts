import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { HISTORY_ROLLBACK_REJECTION_REASON } from '@wizard-archive/editor/resources/history-contract'
import { historyEntryIdValidator } from '../editHistory/schema'
import { resourceIdValidator } from '../resources/validators'

export const rollbackRejectionReasonValidator = literals(
  HISTORY_ROLLBACK_REJECTION_REASON.contentChanged,
  HISTORY_ROLLBACK_REJECTION_REASON.historyEntryUnavailable,
  HISTORY_ROLLBACK_REJECTION_REASON.itemUnavailable,
  HISTORY_ROLLBACK_REJECTION_REASON.snapshotIncompatible,
  HISTORY_ROLLBACK_REJECTION_REASON.snapshotUnavailable,
  HISTORY_ROLLBACK_REJECTION_REASON.unsupportedItemType,
)

export const rollbackResultValidator = v.union(
  v.object({
    status: v.literal('restored'),
    historyEntryId: historyEntryIdValidator,
    preservedHistoryEntryId: historyEntryIdValidator,
    restoredFromHistoryEntryId: historyEntryIdValidator,
    restoredItemId: resourceIdValidator,
  }),
  v.object({
    status: v.literal('rejected'),
    reason: rollbackRejectionReasonValidator,
  }),
)

export type RollbackServerResult = Infer<typeof rollbackResultValidator>
export type RollbackServerRejectionReason = Extract<
  RollbackServerResult,
  { status: 'rejected' }
>['reason']
