import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import type { Infer } from 'convex/values'

export const SNAPSHOT_CAPTURE_REJECTION_REASON = {
  historyUnavailable: 'history_unavailable',
  itemUnavailable: 'item_unavailable',
  revisionChanged: 'revision_changed',
  snapshotIncompatible: 'snapshot_incompatible',
} as const

const snapshotCaptureRejectionReasonValidator = literals(
  SNAPSHOT_CAPTURE_REJECTION_REASON.historyUnavailable,
  SNAPSHOT_CAPTURE_REJECTION_REASON.itemUnavailable,
  SNAPSHOT_CAPTURE_REJECTION_REASON.revisionChanged,
  SNAPSHOT_CAPTURE_REJECTION_REASON.snapshotIncompatible,
)

export const snapshotCaptureResultValidator = v.union(
  v.object({ status: v.literal('captured'), snapshotId: v.id('documentSnapshots') }),
  v.object({
    status: v.literal('rejected'),
    reason: snapshotCaptureRejectionReasonValidator,
  }),
)

export type SnapshotCaptureResult = Infer<typeof snapshotCaptureResultValidator>
