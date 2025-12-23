import type { Id } from '../_generated/dataModel'
import type { Tag } from '../tags/types'

export type Session = Tag & {
  tagId: Id<'tags'>
  sessionId: Id<'sessions'>
  endedAt?: number
}
