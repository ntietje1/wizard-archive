import type { Id } from '../_generated/dataModel'
import type { Tag } from '../tags/types'

export type Location = Tag & {
  tagId: Id<'tags'>
  locationId: Id<'locations'>
}
