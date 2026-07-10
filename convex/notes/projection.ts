import { v } from 'convex/values'
import { NOTE_PROJECTION_REJECTION_REASON } from '../../shared/yjs-sync/note-projection'

export const noteProjectionResultValidator = v.union(
  v.object({ status: v.literal('projected'), throughSeq: v.number() }),
  v.object({
    status: v.literal('rejected'),
    reason: v.literal(NOTE_PROJECTION_REJECTION_REASON.invalidDocument),
  }),
)
