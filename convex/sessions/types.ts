import { Id } from '../_generated/dataModel'
import { Tag } from '../tags/types'

export type Session = Tag & {
  tagId: Id<'tags'>
  sessionId: Id<'sessions'>
  endedAt?: number
}
