export const AWARENESS_HEARTBEAT_MS = 10 * 1000
export const AWARENESS_TTL_MS = 30 * 1000
export const AWARENESS_CLEANUP_BATCH_SIZE = 100

export const AWARENESS_REJECTION_REASON = {
  sessionConflict: 'session_conflict',
  sessionRequired: 'session_required',
} as const

export type AwarenessLeaseResult =
  | { status: 'active'; expiresAt: number }
  | {
      status: 'rejected'
      reason: (typeof AWARENESS_REJECTION_REASON)[keyof typeof AWARENESS_REJECTION_REASON]
    }

export type AwarenessReleaseResult =
  | { status: 'released' }
  | { status: 'unavailable' }
  | {
      status: 'rejected'
      reason: (typeof AWARENESS_REJECTION_REASON)[keyof typeof AWARENESS_REJECTION_REASON]
    }
