import type { Id } from '../_generated/dataModel'
import type { Tag } from '../tags/types'

export type Character = Tag & {
  tagId: Id<'tags'>
  characterId: Id<'characters'>
  playerId?: Id<'campaignMembers'>
}
