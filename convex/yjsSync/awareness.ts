import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { AWARENESS_REJECTION_REASON } from '../../shared/yjs-sync/awareness'

const awarenessRejectionReasonValidator = literals(
  AWARENESS_REJECTION_REASON.sessionConflict,
  AWARENESS_REJECTION_REASON.sessionRequired,
)

export const awarenessLeaseResultValidator = v.union(
  v.object({ status: v.literal('active'), expiresAt: v.number() }),
  v.object({ status: v.literal('rejected'), reason: awarenessRejectionReasonValidator }),
)

export const awarenessReleaseResultValidator = v.union(
  v.object({ status: v.literal('released') }),
  v.object({ status: v.literal('unavailable') }),
  v.object({ status: v.literal('rejected'), reason: awarenessRejectionReasonValidator }),
)
