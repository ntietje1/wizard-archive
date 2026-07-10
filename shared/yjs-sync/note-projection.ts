export const NOTE_PROJECTION_REJECTION_REASON = {
  invalidDocument: 'invalid_document',
} as const

export type NoteProjectionResult =
  | { status: 'projected'; throughSeq: number }
  | {
      status: 'rejected'
      reason: (typeof NOTE_PROJECTION_REJECTION_REASON)[keyof typeof NOTE_PROJECTION_REJECTION_REASON]
    }
